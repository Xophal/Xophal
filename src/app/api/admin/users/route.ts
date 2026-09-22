import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError, getPaginationParams, paginatedResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    const adminClient = createAdminClient();
    const { searchParams } = request.nextUrl;
    const { page, limit, offset } = getPaginationParams(searchParams);
    const search = (searchParams.get("q") || "").trim();
    const role = searchParams.get("role");
    const isActive = searchParams.get("isActive");

    let query = adminClient.from("profiles").select("id, full_name, email, is_active, email_verified, created_at, roles(code, name)", { count: "exact" }).order("created_at", { ascending: false });

    if (search) {
      // search full_name or email
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (role) {
      query = query.eq("roles.code", role);
    }

    if (isActive === "true") query = query.eq("is_active", true);
    if (isActive === "false") query = query.eq("is_active", false);

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    return apiSuccess(paginatedResponse(data ?? [], count ?? 0, page, limit));
  } catch (error) {
    return handleApiError(error);
  }
}
