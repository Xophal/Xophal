import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const submissionPatchSchema = z.object({
  status: z.enum(["approved", "rejected", "duplicate_flagged", "cancelled", "under_review"]),
  reason: z.string().max(1000).optional().nullable(),
  duplicate_of: z.string().uuid().optional().nullable(),
  verified_amount_minor: z.number().int().positive().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdminRole(["admin", "super_admin", "payment_verifier", "subscription_admin", "refund_approver"]);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      return apiError("A valid payment submission ID is required.", 400, "INVALID_SUBMISSION_ID");
    }
    const payload = await validateBody(submissionPatchSchema, await request.json());
    const admin = createAdminClient();

    if (payload.status === "approved" || payload.status === "rejected") {
      if (payload.status === "approved" && payload.verified_amount_minor === undefined) {
        return apiError("Enter the actual incoming amount before approving this payment.", 400, "VERIFIED_AMOUNT_REQUIRED");
      }
      const { data, error } = await admin.rpc("resolve_manual_payment_submission", {
        p_submission_id: id,
        p_actor_id: session.user.id,
        p_status: payload.status,
        p_reason: payload.reason ?? null,
        p_verified_amount_minor: payload.verified_amount_minor ?? null,
      });
      if (error) throw error;
      if (!data) return apiError("Payment submission not found", 404, "NOT_FOUND");
      return apiSuccess(data);
    }

    if (payload.status === "under_review") {
      if (!payload.reason) return apiError("A reason or requested information is required.", 400, "REASON_REQUIRED");
      const { data, error } = await admin.rpc("set_manual_payment_submission_under_review", {
        p_submission_id: id,
        p_actor_id: session.user.id,
        p_reason: payload.reason,
      });
      if (error) throw error;
      return apiSuccess(data);
    }

    const { data, error } = await admin.rpc("set_manual_payment_submission_flag", {
      p_submission_id: id,
      p_actor_id: session.user.id,
      p_status: payload.status,
      p_reason: payload.reason ?? null,
      p_duplicate_of: payload.status === "duplicate_flagged" ? payload.duplicate_of ?? null : null,
    });
    if (error) {
      if (error.message.includes("no longer actionable")) {
        return apiError("Payment submission was not found or has already been reviewed.", 409, "SUBMISSION_ALREADY_REVIEWED");
      }
      throw error;
    }
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
