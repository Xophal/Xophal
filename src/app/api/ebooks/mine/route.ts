import { NextRequest } from "next/server";
import { ApiError, apiSuccess, assertTrustedOrigin, getPaginationParams, handleApiError, paginatedResponse, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMarketplaceConfig } from "@/lib/ebooks/config";
import { releaseDueEbookBalances } from "@/lib/ebooks/orders";
import { ebookSubmissionSchema } from "@/lib/ebooks/schema";
import { createEbookListing } from "@/lib/ebooks/submit";

const EMPTY_SALES = { transaction_count: 0, gross_sales: 0, xophol_commission: 0, seller_earnings: 0 };
const EMPTY_EARNINGS = {
  sales_count: 0, gross_sales: 0, commission_total: 0, seller_gross: 0,
  payment_fees: 0, tax_total: 0, refunds_total: 0, seller_net_total: 0,
  pending_amount: 0, available_amount: 0, paid_amount: 0,
};

function rateLimitOrError(error: unknown) {
  if (error instanceof Error && error.message === "RATE_LIMIT") {
    return new Response(JSON.stringify({ success: false, error: "Too many requests.", code: "RATE_LIMIT" }), {
      status: 429,
      headers: { "content-type": "application/json" },
    });
  }
  return handleApiError(error);
}

/** The signed-in seller's listings plus verified sales and earnings. */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required.", "UNAUTHORIZED");
    const { page, limit, offset } = getPaginationParams(request.nextUrl.searchParams);
    const admin = createAdminClient();

    // Advance the delayed-payout state machine before reporting balances.
    const config = await getMarketplaceConfig();
    await releaseDueEbookBalances(config.payoutHoldDays).catch(() => undefined);

    const [{ data: books, count, error }, salesResult, earningsResult] = await Promise.all([
      admin
        .from("ebook_listings")
        .select("id, title, slug, cover_image_url, status, price, currency, author_name, rejection_reason, view_count, is_featured, published_at, created_at, ebook_categories(name)", { count: "exact" })
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1),
      admin.rpc("get_ebook_sales_summary", { p_user_id: session.user.id }),
      admin.rpc("get_ebook_earnings_summary", { p_user_id: session.user.id }),
    ]);
    if (error) throw error;

    return apiSuccess({
      ...paginatedResponse(books ?? [], count ?? 0, page, limit),
      counts: (books ?? []).reduce<Record<string, number>>((accumulator, book) => {
        accumulator[book.status] = (accumulator[book.status] ?? 0) + 1;
        return accumulator;
      }, {}),
      sales: salesResult.error ? EMPTY_SALES : salesResult.data?.[0] ?? EMPTY_SALES,
      earnings: earningsResult.error ? EMPTY_EARNINGS : earningsResult.data?.[0] ?? EMPTY_EARNINGS,
      commissionPercent: config.commissionPercent,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Creates a new listing for the signed-in seller. */
export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    await checkRateLimit(request);
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required.", "UNAUTHORIZED");
    requireVerifiedSession(session.profile, session.user, {});
    const payload = await validateBody(ebookSubmissionSchema, await request.json());
    const listing = await createEbookListing({ userId: session.user.id, payload });
    return apiSuccess({ listing, listingFee: 0 }, 201);
  } catch (error) {
    return rateLimitOrError(error);
  }
}
