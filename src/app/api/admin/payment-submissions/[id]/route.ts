import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const submissionPatchSchema = z.object({
  status: z.enum(["approved", "rejected", "duplicate_flagged", "cancelled"]),
  reason: z.string().max(1000).optional().nullable(),
  duplicate_of: z.string().uuid().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdminRole(["admin", "super_admin", "payment_verifier", "subscription_admin", "refund_approver", "school_eligibility_reviewer"]);
    const { id } = await params;
    const payload = await validateBody(submissionPatchSchema, await request.json());
    const admin = createAdminClient();

    if (payload.status === "approved" || payload.status === "rejected") {
      const { data, error } = await admin.rpc("resolve_manual_payment_submission", {
        p_submission_id: id,
        p_actor_id: session.user.id,
        p_status: payload.status,
        p_reason: payload.reason ?? null,
      });
      if (error) throw error;
      if (!data) return apiError("Payment submission not found", 404, "NOT_FOUND");
      return apiSuccess(data);
    }

    const updatePayload: Record<string, unknown> = {
      status: payload.status,
      reason: payload.reason ?? null,
      approved_by: session.user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    updatePayload.duplicate_of = payload.status === "duplicate_flagged" ? payload.duplicate_of ?? null : null;

    const { data, error } = await admin
      .from("payment_submissions")
      .update(updatePayload)
      .eq("id", id)
      .eq("status", "pending_verification")
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return apiError("Payment submission was not found or has already been reviewed", 409, "SUBMISSION_ALREADY_REVIEWED");

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
