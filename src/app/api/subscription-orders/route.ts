import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const createOrderSchema = z.object({
  plan_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    await checkRateLimit(request);

    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Please sign in before starting checkout.", "UNAUTHORIZED");
    requireVerifiedSession(session.profile, session.user, { allowRoles: ["student"] });

    const payload = await validateBody(createOrderSchema, await request.json());
    const admin = createAdminClient();
    const { data: settings, error: settingsError } = await admin
      .from("manual_payment_settings")
      .select("upi_id, payee_name, instructions, is_enabled")
      .eq("id", 1)
      .maybeSingle();
    if (settingsError) throw settingsError;
    if (!settings?.is_enabled || !settings.upi_id) {
      throw new ApiError(503, "Manual UPI payments are not configured yet.", "MANUAL_PAYMENTS_NOT_CONFIGURED");
    }

    const { data, error } = await admin.rpc("create_manual_subscription_order", {
      p_user_id: session.user.id,
      p_plan_id: payload.plan_id,
    });
    if (error) {
      if (error.message.includes("not available")) {
        throw new ApiError(404, "The selected subscription plan is no longer available.", "PLAN_NOT_AVAILABLE");
      }
      if (error.message.includes("not configured")) {
        throw new ApiError(503, "The selected plan is not configured for manual UPI payments.", "PLAN_NOT_CONFIGURED");
      }
      throw error;
    }

    const result = data as { order?: Record<string, unknown>; already_exists?: boolean } | null;
    if (!result?.order) {
      throw new ApiError(500, "Unable to create the subscription order.", "ORDER_CREATE_FAILED");
    }

    return apiSuccess({
      order: result.order,
      already_exists: Boolean(result.already_exists),
      payment: {
        upi_id: settings.upi_id,
        payee_name: settings.payee_name || "Xophal",
        instructions: settings.instructions,
      },
    }, result.already_exists ? 200 : 201);
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") {
      return new Response(JSON.stringify({ success: false, error: "Too many requests.", code: "RATE_LIMIT" }), {
        status: 429,
        headers: { "content-type": "application/json" },
      });
    }
    return handleApiError(error);
  }
}
