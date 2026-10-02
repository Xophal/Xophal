import { NextRequest } from "next/server";
import { apiSuccess, getPaginationParams, handleApiError, paginatedResponse } from "@/lib/api-utils";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

import { EBOOK_STATUSES, isEbookStatus } from "@/lib/ebooks/moderation";

const SORTS: Record<string, { column: string; ascending: boolean }> = {
  newest: { column: "created_at", ascending: false },
  oldest: { column: "created_at", ascending: true },
  submitted: { column: "submitted_at", ascending: false },
  updated: { column: "updated_at", ascending: false },
  published: { column: "published_at", ascending: false },
};

/** Escape PostgREST `or=` filter values so punctuation cannot alter the filter. */
function ilike(value: string) {
  return `%${value.replace(/[%,()]/g, " ")}%`;
}


/**
 * Admin listing queue: paginated listings, per-status counts, moderation
 * statistics and live marketplace revenue. Search (spec §17) covers title,
 * author, seller, eBook id, category, exam and subject; filters (spec §18)
 * cover status, category, exam, language, seller, submission window and sort.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminRole(["super_admin", "admin", "content_manager", "reviewer"]);
    const { page, limit, offset } = getPaginationParams(request.nextUrl.searchParams);
    const params = request.nextUrl.searchParams;
    const status = params.get("status");
    const search = params.get("q")?.trim().slice(0, 100);
    const category = params.get("category")?.trim().slice(0, 100);
    const exam = params.get("exam")?.trim().slice(0, 100);
    const language = params.get("language")?.trim().slice(0, 80);
    const seller = params.get("seller")?.trim().slice(0, 100);
    const submittedFrom = params.get("submittedFrom");
    const submittedTo = params.get("submittedTo");
    const sort = SORTS[params.get("sort") ?? "submitted"] ?? SORTS.submitted;
    const admin = createAdminClient();

    let query = admin
      .from("ebook_listings")
      .select("id, title, slug, cover_image_url, status, price, currency, author_name, is_featured, rejection_reason, seller_feedback, admin_review_note, language, subject, exam, view_count, external_click_count, submitted_at, published_at, created_at, updated_at, user_id, ebook_categories(name, slug), profiles(full_name, email)", { count: "exact" });
    if (status && isEbookStatus(status)) query = query.eq("status", status);
    if (category) query = query.eq("category_id", category);
    if (exam) query = query.eq("exam_id", exam);
    if (language) query = query.eq("language", language);
    if (seller) query = query.or(`full_name.ilike.${ilike(seller)},email.ilike.${ilike(seller)}`, { foreignTable: "profiles" });
    if (submittedFrom) query = query.gte("submitted_at", submittedFrom);
    if (submittedTo) query = query.lte("submitted_at", `${submittedTo}T23:59:59.999Z`);
    if (search) {
      const idClause = /^[0-9a-f-]{36}$/i.test(search) ? `id.eq.${search},` : "";
      query = query.or(
        `${idClause}title.ilike.${ilike(search)},author_name.ilike.${ilike(search)},language.ilike.${ilike(search)},subject.ilike.${ilike(search)},exam.ilike.${ilike(search)},ebook_categories.name.ilike.${ilike(search)},profiles.full_name.ilike.${ilike(search)},profiles.email.ilike.${ilike(search)}`,
        { foreignTable: "profiles" }
      );
    }

    const [{ data, count, error }, revenueResult, commissionRow, statsResult] = await Promise.all([
      query.order(sort.column, { ascending: sort.ascending, nullsFirst: false }).range(offset, offset + limit - 1),
      admin.rpc("get_ebook_admin_revenue"),
      admin.from("ebook_marketplace_settings").select("percentage, setting_value").eq("setting_key", "marketplace_commission_percent").maybeSingle(),
      admin.rpc("get_ebook_moderation_stats"),
    ]);
    if (error) throw error;

    const counts: Record<string, number> = {};
    await Promise.all(
      EBOOK_STATUSES.map(async (value) => {
        const { count: total } = await admin.from("ebook_listings").select("id", { count: "exact", head: true }).eq("status", value);
        counts[value] = total ?? 0;
      })
    );

    const commissionPercent =
      Number(commissionRow.data?.percentage ?? commissionRow.data?.setting_value ?? Number.NaN) || 0;

    return apiSuccess({
      ...paginatedResponse(data ?? [], count ?? 0, page, limit),
      counts,
      stats: statsResult.error ? null : statsResult.data?.[0] ?? null,
      revenue: revenueResult.error ? null : revenueResult.data?.[0] ?? null,
      commissionPercent,
    });
  } catch (error) {
    return handleApiError(error);
  }
}