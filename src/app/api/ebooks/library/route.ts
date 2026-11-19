import { NextRequest } from "next/server";
import { ApiError, apiSuccess, getPaginationParams, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required.", "UNAUTHORIZED");
    const { page, limit, offset } = getPaginationParams(request.nextUrl.searchParams);
    const search = request.nextUrl.searchParams.get("q")?.trim();
    const subject = request.nextUrl.searchParams.get("subject")?.trim();
    const board = request.nextUrl.searchParams.get("board")?.trim();
    const className = request.nextUrl.searchParams.get("class")?.trim();
    const from = request.nextUrl.searchParams.get("from")?.trim();

    let query = createAdminClient()
      .from("user_library")
      .select("id, product_id, order_id, access_status, granted_at, ebook_listings(id, title, slug, cover_image_url, subject, exam, language, price, currency, subject_id, subjects(name, classes(name, boards(name))))", { count: "exact" })
      .eq("user_id", session.user.id)
      .eq("access_status", "active")
      .order("granted_at", { ascending: false });

    if (subject) query = query.eq("ebook_listings.subject", subject);
    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    const filtered = (data ?? []).filter((row) => {
      const listing = Array.isArray(row.ebook_listings) ? row.ebook_listings[0] : row.ebook_listings;
      if (search && !String(listing?.title ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      if (subject && listing?.subject !== subject) return false;
      if (board) {
        const subjects = Array.isArray(listing?.subjects) ? listing.subjects : listing?.subjects ? [listing.subjects] : [];
        const names = subjects.flatMap((item: Record<string, unknown>) => {
          const classes = Array.isArray(item?.classes) ? item.classes : item?.classes ? [item.classes] : [];
          return classes.flatMap((classItem: unknown) => {
            const classRecord = classItem as Record<string, unknown>;
            const boards = Array.isArray(classRecord?.boards) ? classRecord.boards : classRecord?.boards ? [classRecord.boards] : [];
            return boards.map((boardItem: unknown) => (boardItem as Record<string, unknown>)?.name);
          });
        });
        if (!names.includes(board)) return false;
      }
      if (className) {
        const subjects = Array.isArray(listing?.subjects) ? listing.subjects : listing?.subjects ? [listing.subjects] : [];
        const names = subjects.flatMap((item: Record<string, unknown>) => {
          const classes = Array.isArray(item?.classes) ? item.classes : item?.classes ? [item.classes] : [];
          return classes.map((classItem: unknown) => (classItem as Record<string, unknown>)?.name);
        });
        if (!names.includes(className)) return false;
      }
      if (from && new Date(row.granted_at).getTime() < new Date(from).getTime()) return false;
      return true;
    });

    const orderIds = filtered.map((row) => row.order_id);
    const { data: orders, error: orderError } = orderIds.length
      ? await createAdminClient().from("ebook_transactions").select("id, order_number, status, paid_at").in("id", orderIds).eq("buyer_user_id", session.user.id)
      : { data: [], error: null };
    if (orderError) throw orderError;
    const orderById = new Map((orders ?? []).map((order) => [order.id, order]));
    return apiSuccess({
      data: filtered.map((row) => ({ ...row, ebook_transactions: orderById.get(row.order_id) ?? null })),
      pagination: { page, limit, total: count ?? filtered.length, totalPages: Math.ceil((count ?? filtered.length) / limit), hasMore: page * limit < (count ?? filtered.length) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
