import { NextRequest } from "next/server";
import { apiSuccess, handleApiError, getPaginationParams, paginatedResponse } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) return new Response(null, { status: 401 });
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") || "1");
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || "20")));
    const offset = (page - 1) * limit;

    const supabase = await createClient();
    const query = supabase
      .from("notifications")
      .select("id, title, message, type, link_url, is_read, is_global, created_at", { count: "exact" })
      .or(`user_id.eq.${session.user.id},is_global.eq.true`)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    // Unread count
    const { data: unreadData, count: unreadCount } = await supabase
      .from("notifications")
      .select("id", { count: "exact" })
      .or(`user_id.eq.${session.user.id},is_global.eq.true`)
      .eq("is_read", false);

    const resp = paginatedResponse(data || [], count || 0, page, limit);
    return apiSuccess({ ...resp, unread: unreadCount || 0 });
  } catch (err) {
    return handleApiError(err);
  }
}
