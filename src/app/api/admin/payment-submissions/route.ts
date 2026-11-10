import { NextRequest } from "next/server";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError, getPaginationParams, paginatedResponse } from "@/lib/api-utils";
import { normalizeRoleCode } from "@/lib/roles";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdminRole(["admin", "super_admin", "payment_verifier", "subscription_admin", "refund_approver", "school_eligibility_reviewer"]);
    const role = normalizeRoleCode(session.profile);
    const canViewReceipts = ["admin", "super_admin", "payment_verifier", "subscription_admin"].includes(role ?? "");
    const { searchParams } = request.nextUrl;
    const { page, limit, offset } = getPaginationParams(searchParams);
    const status = searchParams.get("status");

    const admin = createAdminClient();
    let query = admin
      .from("payment_submissions")
      .select("id, user_id, product_id, school_id, payment_method, amount_minor, final_amount_minor, claimed_amount_minor, payment_paid_at, currency, status, reference_code, student_note, receipt_path, created_at, approved_by, approved_at, reason, product_snapshot, profiles(full_name, email), product_catalog(code, name, product_type)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    const submissions = await Promise.all((data ?? []).map(async (submission) => {
      let receiptUrl: string | null = null;
      if (submission.receipt_path && canViewReceipts) {
        const { data: signedReceipt, error: receiptError } = await admin.storage
          .from("upi-receipts")
          .createSignedUrl(submission.receipt_path, 300);
        if (receiptError) throw receiptError;
        receiptUrl = signedReceipt.signedUrl;
      }

      const { receipt_path: _receiptPath, ...safeSubmission } = submission;
      void _receiptPath;
      return { ...safeSubmission, receipt_url: receiptUrl };
    }));

    return apiSuccess({
      ...paginatedResponse(submissions, count ?? 0, page, limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
