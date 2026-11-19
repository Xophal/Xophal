import { NextRequest } from "next/server";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError, getPaginationParams, paginatedResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requireAdminRole(["admin", "super_admin", "subscription_admin", "payment_verifier", "refund_approver"]);
    const { searchParams } = request.nextUrl;
    const { page, limit, offset } = getPaginationParams(searchParams);
    const status = searchParams.get("status");
    const search = (searchParams.get("q") || "").trim();

    let query = createAdminClient()
      .from("subscriptions")
      .select("id, status, starts_at, expires_at, auto_renew, created_at, profiles(full_name, email), subscription_plans(name, code, price, currency), subscription_refunds(id, amount_minor, status, refund_reference, refund_date, reason, revoke_access, created_at)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (search) query = query.or(`profiles.full_name.ilike.%${search}%,profiles.email.ilike.%${search}%`);

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    const now = Date.now();
    const items = (data ?? []).map((subscription) => ({
      ...subscription,
      effective_status: subscription.status === "active"
        ? new Date(subscription.expires_at).getTime() <= now
          ? "expired"
          : new Date(subscription.starts_at).getTime() > now
            ? "queued"
            : "active"
        : subscription.status,
    }));
    return apiSuccess(paginatedResponse(items, count ?? 0, page, limit));
  } catch (error) {
    return handleApiError(error);
  }
}
