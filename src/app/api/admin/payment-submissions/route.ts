import { NextRequest } from "next/server";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError, getPaginationParams, paginatedResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requireAdminRole(["admin", "super_admin", "payment_verifier", "subscription_admin", "refund_approver", "school_eligibility_reviewer"]);
    const { searchParams } = request.nextUrl;
    const { page, limit, offset } = getPaginationParams(searchParams);
    const status = searchParams.get("status");

    let query = createAdminClient()
      .from("payment_submissions")
      .select("id, user_id, product_id, subscription_plan_id, order_reference, school_id, payment_method, amount_minor, final_amount_minor, currency, status, reference_code, payment_paid_at, payment_note, verified_amount_minor, verified_at, evidence_url, product_snapshot, created_at, approved_by, approved_at, reason, profiles(full_name, email), product_catalog(code, name, product_type), subscription_plans(code, name)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    const admin = createAdminClient();
    const items = await Promise.all((data ?? []).map(async (submission) => {
      const evidencePath = submission.evidence_url;
      if (!evidencePath) {
        return submission;
      }
      if (!evidencePath.startsWith(`${submission.user_id}/subscription-evidence/`)) {
        return { ...submission, evidence_url: null };
      }
      const { data: signedEvidence, error: signedEvidenceError } = await admin.storage
        .from("subscription-payment-evidence")
        .createSignedUrl(evidencePath, 10 * 60);
      if (signedEvidenceError) throw signedEvidenceError;
      return { ...submission, evidence_url: signedEvidence.signedUrl };
    }));

    return apiSuccess({
      ...paginatedResponse(items, count ?? 0, page, limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
