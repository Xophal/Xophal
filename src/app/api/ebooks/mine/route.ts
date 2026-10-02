import { NextRequest } from "next/server";
import { ApiError, apiSuccess, assertTrustedOrigin, getPaginationParams, handleApiError, paginatedResponse, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { ebookDraftRequestSchema, ebookSubmissionSchema } from "@/lib/ebooks/schema";
import { createEbookListing } from "@/lib/ebooks/submit";
import { EBOOK_LISTING_STATUSES } from "@/lib/ebooks/status";

function rateLimitOrError(error: unknown) {
  if (error instanceof Error && error.message === "RATE_LIMIT") {
    return new Response(JSON.stringify({ success: false, error: "Too many requests.", code: "RATE_LIMIT" }), {
      status: 429,
      headers: { "content-type": "application/json" },
    });
  }
  return handleApiError(error);
}

/** The signed-in seller's listings and all-time moderation counts. */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required.", "UNAUTHORIZED");
    const { page, limit, offset } = getPaginationParams(request.nextUrl.searchParams);
    const admin = createAdminClient();

    const [{ data: books, count, error }, statusRows] = await Promise.all([
      admin
        .from("ebook_listings")
        .select("id, title, slug, cover_image_url, status, price, currency, author_name, rejection_reason, seller_feedback, view_count, is_featured, published_at, created_at, ebook_categories(name)", { count: "exact" })
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1),
      Promise.all(EBOOK_LISTING_STATUSES.map(async (status) => {
        const result = await admin.from("ebook_listings").select("id", { count: "exact", head: true })
          .eq("user_id", session.user.id).eq("status", status);
        return [status, result.count ?? 0] as const;
      })),
    ]);
    if (error) throw error;

    return apiSuccess({
      ...paginatedResponse(books ?? [], count ?? 0, page, limit),
      counts: Object.fromEntries(statusRows),
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
    const requestPayload = await validateBody(ebookDraftRequestSchema, await request.json());
    const action = requestPayload.action ?? "save_draft";
    const payload = action === "submit"
      ? await validateBody(ebookSubmissionSchema, requestPayload.payload)
      : requestPayload.payload;
    const listing = await createEbookListing({ userId: session.user.id, payload, action });
    return apiSuccess({ listing, listingFee: 0 }, 201);
  } catch (error) {
    return rateLimitOrError(error);
  }
}
