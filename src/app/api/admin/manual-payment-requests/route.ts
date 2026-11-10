import { NextRequest } from "next/server";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, getPaginationParams, handleApiError, paginatedResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requireAdminRole(["admin", "super_admin", "payment_verifier", "subscription_admin"]);
    const { page, limit, offset } = getPaginationParams(request.nextUrl.searchParams);
    const status = request.nextUrl.searchParams.get("status");
    let query = createAdminClient()
      .from("manual_payment_requests")
      .select("id, user_id, resource_type, title_snapshot, amount_minor, currency, reference_code, evidence_url, status, reason, submitted_at, created_at, profiles(full_name, email)", { count: "exact" })
      .order("submitted_at", { ascending: false });
    if (status) query = query.eq("status", status);

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    return apiSuccess(paginatedResponse(data ?? [], count ?? 0, page, limit));
  } catch (error) {
    return handleApiError(error);
  }
}
