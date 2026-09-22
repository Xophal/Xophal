import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, handleApiError, validateBody } from "@/lib/api-utils";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { z } from "zod";
import { serverEnv } from "@/lib/env.server";

const createPaymentSchema = z.object({
  planId: z.string().uuid(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = await validateBody(createPaymentSchema, body);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Authentication required", 401, "UNAUTHORIZED");
    }

    const { data: profile } = await supabase.from("profiles").select("*, roles(code)").eq("id", user.id).maybeSingle();
    try {
      requireVerifiedSession(profile, user, { allowRoles: ["student"] });
    } catch (error) {
      return apiError(error instanceof Error ? error.message : "Authentication required", 403, "FORBIDDEN");
    }

    const adminClient = createAdminClient();
    const { data: plan, error: planError } = await adminClient
      .from("subscription_plans")
      .select("id, name, price, currency, duration_days")
      .eq("id", payload.planId)
      .eq("is_active", true)
      .maybeSingle();

    if (planError) throw planError;
    if (!plan) return apiError("Plan not found", 404, "PLAN_NOT_FOUND");

    if (!serverEnv.RAZORPAY_KEY_ID || !serverEnv.RAZORPAY_KEY_SECRET) {
      return apiError("Payments are not configured yet", 503, "PAYMENTS_NOT_CONFIGURED");
    }

    const Razorpay = (await import("razorpay")).default;
    const razorpay = new Razorpay({ key_id: serverEnv.RAZORPAY_KEY_ID, key_secret: serverEnv.RAZORPAY_KEY_SECRET });
    const order = await razorpay.orders.create({
      amount: Math.round(Number(plan.price) * 100),
      currency: plan.currency || "INR",
      receipt: `xophal_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: { plan_id: plan.id, user_id: user.id },
    });

    const payment = {
      user_id: user.id,
      plan_id: plan.id,
      amount: Number(plan.price),
      final_amount: Number(plan.price),
      currency: plan.currency || "INR",
      razorpay_order_id: order.id,
      status: "pending",
      metadata: payload.metadata ?? {},
    };

    const { data, error } = await adminClient.from("payments").insert([payment]).select().single();

    if (error) throw error;

    return apiSuccess({ payment: data, gateway: "razorpay", keyId: serverEnv.RAZORPAY_KEY_ID, order, durationDays: plan.duration_days });
  } catch (error) {
    return handleApiError(error);
  }
}
