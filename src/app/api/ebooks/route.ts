import { NextRequest } from "next/server";
import { ApiError, apiSuccess, assertTrustedOrigin, getPaginationParams, handleApiError, paginatedResponse, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { checkRateLimit } from "@/lib/rate-limit";
import { listPublishedEbooks, type EbookFilters } from "@/lib/ebooks/data";
import { ebookSubmissionSchema } from "@/lib/ebooks/schema";
import { createEbookListing } from "@/lib/ebooks/submit";

const SORTS = ["latest", "popular", "price_low", "price_high"] as const;

function numeric(value: string | null) {
  if (!value || !/^\d{1,7}(\.\d{1,2})?$/.test(value)) return undefined;
  return Number(value);
}

/** Public, paginated catalogue of published eBooks. */
export async function GET(request: NextRequest) {
  try {
    await checkRateLimit(request);
    const { searchParams } = request.nextUrl;
    const { page, limit } = getPaginationParams(searchParams);
    const price = searchParams.get("price");
    const sort = searchParams.get("sort");
    const filters: EbookFilters = {
      search: searchParams.get("q") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      author: searchParams.get("author") ?? undefined,
      language: searchParams.get("language") ?? undefined,
      price: price === "free" || price === "paid" ? price : undefined,
      minPrice: numeric(searchParams.get("minPrice")),
      maxPrice: numeric(searchParams.get("maxPrice")),
      sort: SORTS.includes(sort as typeof SORTS[number]) ? (sort as typeof SORTS[number]) : "latest",
      page,
      limit,
    };
    const { books, total, page: current, limit: size } = await listPublishedEbooks(filters);
    return apiSuccess(paginatedResponse(books, total, current, size));
  } catch (error) {
    return rateLimitOrError(error);
  }
}

/** Creates a new listing. Listings are free and always enter review. */
export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    await checkRateLimit(request);
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Sign in to publish an eBook listing.", "UNAUTHORIZED");
    requireVerifiedSession(session.profile, session.user, {});
    const payload = await validateBody(ebookSubmissionSchema, await request.json());
    const listing = await createEbookListing({ userId: session.user.id, payload });
    return apiSuccess({ listing, listingFee: 0 }, 201);
  } catch (error) {
    return rateLimitOrError(error);
  }
}

function rateLimitOrError(error: unknown) {
  if (error instanceof Error && error.message === "RATE_LIMIT") {
    return new Response(JSON.stringify({ success: false, error: "Too many requests.", code: "RATE_LIMIT" }), {
      status: 429,
      headers: { "content-type": "application/json" },
    });
  }
  return handleApiError(error);
}
