import { NextRequest } from "next/server";
import { apiSuccess, handleApiError, paginatedResponse } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { applyNotificationReceipts } from "@/lib/notification-state";

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

    const receiptQuery = supabase
      .from("notification_receipts")
      .select("notification_id, is_read, is_dismissed")
      .eq("user_id", session.user.id);
    const personalUnreadQuery = supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.user.id)
      .eq("is_read", false);
    const globalUnreadQuery = supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("is_global", true)
      .is("user_id", null);
    const readReceiptsQuery = supabase
      .from("notification_receipts")
      .select("notification_id", { count: "exact", head: true })
      .eq("user_id", session.user.id)
      .or("is_read.eq.true,is_dismissed.eq.true");

    const [receiptResult, personalUnreadResult, globalUnreadResult, readReceiptsResult] = await Promise.all([
      receiptQuery,
      personalUnreadQuery,
      globalUnreadQuery,
      readReceiptsQuery,
    ]);
    if (receiptResult.error || personalUnreadResult.error || globalUnreadResult.error || readReceiptsResult.error) {
      throw receiptResult.error || personalUnreadResult.error || globalUnreadResult.error || readReceiptsResult.error;
    }

    const visibleData = applyNotificationReceipts(data || [], receiptResult.data || []);
    const unreadCount = (personalUnreadResult.count || 0) + Math.max(0, (globalUnreadResult.count || 0) - (readReceiptsResult.count || 0));
    const resp = paginatedResponse(visibleData, count || 0, page, limit);
    return apiSuccess({ ...resp, unread: unreadCount });
  } catch (err) {
    return handleApiError(err);
  }
}
