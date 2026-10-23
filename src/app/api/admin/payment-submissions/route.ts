import { NextRequest } from "next/server";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError, getPaginationParams, paginatedResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requireAdminRole(["payment_verifier", "subscription_admin", "refund_approver", "school_eligibility_reviewer"]);
    const { searchParams } = request.nextUrl;
    const { page, limit, offset } = getPaginationParams(searchParams);
    const status = searchParams.get("status");

    let query = createAdminClient()
      .from("payment_submissions")
      .select("id, user_id, product_id, school_id, payment_method, amount_minor, final_amount_minor, currency, status, reference_code, evidence_url, created_at, approved_by, approved_at, reason, profiles(full_name, email), product_catalog(code, name, product_type)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    return apiSuccess({
      ...paginatedResponse(data ?? [], count ?? 0, page, limit),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
