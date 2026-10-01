import { NextRequest } from "next/server";
import { apiSuccess, getPaginationParams, handleApiError, paginatedResponse } from "@/lib/api-utils";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const STATUSES = ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "SUSPENDED"] as const;

/**
 * Admin listing queue: paginated listings, per-status counts, live marketplace
 * revenue (verified orders only) and the current commission configuration.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminRole(["super_admin", "admin", "content_manager", "reviewer"]);
    const { page, limit, offset } = getPaginationParams(request.nextUrl.searchParams);
    const status = request.nextUrl.searchParams.get("status");
    const search = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100);
    const admin = createAdminClient();

    let query = admin
      .from("ebook_listings")
      .select("id, title, slug, cover_image_url, status, price, currency, author_name, is_featured, rejection_reason, admin_review_note, view_count, external_click_count, submitted_at, published_at, created_at, ebook_categories(name, slug), profiles(full_name, email)", { count: "exact" });
    if (status && (STATUSES as readonly string[]).includes(status)) query = query.eq("status", status);
    if (search) query = query.or(`title.ilike.%${search}%,author_name.ilike.%${search}%`);

    const [{ data, count, error }, revenueResult, commissionRow] = await Promise.all([
      query.order("submitted_at", { ascending: false, nullsFirst: false }).range(offset, offset + limit - 1),
      admin.rpc("get_ebook_admin_revenue"),
      admin.from("ebook_marketplace_settings").select("percentage, setting_value").eq("setting_key", "marketplace_commission_percent").maybeSingle(),
    ]);
    if (error) throw error;

    const counts: Record<string, number> = {};
    await Promise.all(
      STATUSES.map(async (value) => {
        const { count: total } = await admin.from("ebook_listings").select("id", { count: "exact", head: true }).eq("status", value);
        counts[value] = total ?? 0;
      })
    );

    const commissionPercent =
      Number(commissionRow.data?.percentage ?? commissionRow.data?.setting_value ?? Number.NaN) || 0;

    return apiSuccess({
      ...paginatedResponse(data ?? [], count ?? 0, page, limit),
      counts,
      revenue: revenueResult.error ? null : revenueResult.data?.[0] ?? null,
      commissionPercent,
    });
  } catch (error) {
    return handleApiError(error);
  }
}