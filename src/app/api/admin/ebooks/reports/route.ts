import { NextRequest } from "next/server";
import { apiSuccess, getPaginationParams, handleApiError, paginatedResponse } from "@/lib/api-utils";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** Open and historical moderation reports, newest first. */
export async function GET(request: NextRequest) {
  try {
    await requireAdminRole(["super_admin", "admin", "content_manager", "reviewer"]);
    const { page, limit, offset } = getPaginationParams(request.nextUrl.searchParams);
    const status = request.nextUrl.searchParams.get("status");

    let query = createAdminClient()
      .from("ebook_reports")
      .select("id, reason, details, status, admin_note, reviewed_at, created_at, ebook_id, ebook_listings(title, slug, status), reporter_user_id", { count: "exact" });
    if (status && ["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"].includes(status)) query = query.eq("status", status);

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    const counts: Record<string, number> = {};
    await Promise.all(
      ["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"].map(async (value) => {
        const { count: total } = await createAdminClient().from("ebook_reports").select("id", { count: "exact", head: true }).eq("status", value);
        counts[value] = total ?? 0;
      })
    );

    return apiSuccess({ ...paginatedResponse(data ?? [], count ?? 0, page, limit), counts });
  } catch (error) {
    return handleApiError(error);
  }
}