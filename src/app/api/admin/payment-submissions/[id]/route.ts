import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";

const submissionPatchSchema = z.object({
  status: z.enum(["approved", "rejected", "duplicate_flagged", "cancelled", "refunded"]),
  reason: z.string().max(1000).optional().nullable(),
  duplicate_of: z.string().uuid().optional().nullable(),
  confirm_external_refund: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    assertTrustedOrigin(request);
    const { id } = await params;
    const payload = await validateBody(submissionPatchSchema, await request.json());

    if (payload.status === "refunded") {
      if (!payload.confirm_external_refund) {
        return apiError("Confirm that the full external refund has been sent before recording it.", 400, "REFUND_CONFIRMATION_REQUIRED");
      }
      const session = await requireAdminRole(["super_admin", "admin", "refund_approver"]);
      const { data, error } = await createAdminClient().rpc("resolve_manual_payment_submission_refund", {
        p_submission_id: id,
        p_actor_id: session.user.id,
        p_reason: payload.reason ?? null,
      });
      if (error) throw error;
      return apiSuccess({ id, ...(data as Record<string, unknown>) });
    }

    const session = await requireAdminRole(["super_admin", "admin", "payment_verifier", "subscription_admin"]);

    if (payload.status === "approved" || payload.status === "rejected") {
      const { data, error } = await createAdminClient().rpc("resolve_manual_payment_submission", {
        p_submission_id: id,
        p_actor_id: session.user.id,
        p_status: payload.status,
        p_reason: payload.reason ?? null,
      });
      if (error) throw error;
      return apiSuccess({ id, ...(data as Record<string, unknown>) });
    }

    const { data, error } = await createAdminClient()
      .from("payment_submissions")
      .update({
        status: payload.status,
        reason: payload.reason ?? null,
        duplicate_of: payload.status === "duplicate_flagged" ? payload.duplicate_of ?? null : null,
        approved_by: session.user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending_verification")
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return apiError("Payment submission was not found or has already been reviewed.", 409, "SUBMISSION_ALREADY_REVIEWED");

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
