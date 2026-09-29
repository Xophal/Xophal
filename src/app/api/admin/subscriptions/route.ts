import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError, getPaginationParams, paginatedResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    const { searchParams } = request.nextUrl;
    const { page, limit, offset } = getPaginationParams(searchParams);
    const status = searchParams.get("status");
    const search = (searchParams.get("q") || "").trim();

    let query = createAdminClient()
      .from("subscriptions")
      .select("id, status, starts_at, expires_at, auto_renew, created_at, profiles(full_name, email), subscription_plans(name, code, price, currency)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (search) query = query.or(`profiles.full_name.ilike.%${search}%,profiles.email.ilike.%${search}%`);

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    return apiSuccess(paginatedResponse(data ?? [], count ?? 0, page, limit));
  } catch (error) {
    return handleApiError(error);
  }
}
