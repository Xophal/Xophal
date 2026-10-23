import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const submissionPatchSchema = z.object({
  status: z.enum(["pending_verification", "approved", "rejected", "duplicate_flagged", "cancelled"]),
  reason: z.string().max(1000).optional().nullable(),
  duplicate_of: z.string().uuid().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdminRole(["payment_verifier", "subscription_admin", "refund_approver", "school_eligibility_reviewer"]);
    const { id } = await params;
    const payload = await validateBody(submissionPatchSchema, await request.json());

    const { data: existing, error: fetchError } = await createAdminClient()
      .from("payment_submissions")
      .select("id, status, reason, approved_by, approved_at, duplicate_of, metadata")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      return apiError("Payment submission not found", 404, "NOT_FOUND");
    }

    const updatePayload: Record<string, unknown> = {
      status: payload.status,
      reason: payload.reason ?? existing.reason ?? null,
      approved_by: session.user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (payload.status === "duplicate_flagged") {
      updatePayload.duplicate_of = payload.duplicate_of ?? existing.duplicate_of ?? null;
    } else {
      updatePayload.duplicate_of = null;
    }

    const { data, error } = await createAdminClient()
      .from("payment_submissions")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return apiError("Payment submission not found", 404, "NOT_FOUND");

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
