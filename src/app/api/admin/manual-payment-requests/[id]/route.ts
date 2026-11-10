import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const decisionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reason: z.string().trim().min(3).max(1000).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdminRole(["admin", "super_admin", "payment_verifier", "subscription_admin"]);
    const { id } = await params;
    const payload = await validateBody(decisionSchema, await request.json());
    if (payload.status === "rejected" && !payload.reason) {
      return apiError("A rejection reason is required.", 400, "REASON_REQUIRED");
    }

    const { data, error } = await createAdminClient().rpc("resolve_manual_payment_request", {
      p_request_id: id,
      p_actor_id: session.user.id,
      p_status: payload.status,
      p_reason: payload.reason ?? null,
    });
    if (error) throw error;
    if (!data) return apiError("Payment request not found.", 404, "NOT_FOUND");
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
