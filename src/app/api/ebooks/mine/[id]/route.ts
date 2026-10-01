import { NextRequest } from "next/server";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { createAdminClient } from "@/lib/supabase/admin";
import { ebookSubmissionSchema } from "@/lib/ebooks/schema";
import { updateEbookListing } from "@/lib/ebooks/submit";

type Context = { params: Promise<{ id: string }> };

/** Reads one of the signed-in seller's own listings, including review notes. */
export async function GET(_request: NextRequest, context: Context) {
  try {
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required.", "UNAUTHORIZED");
    const { id } = await context.params;
    const { data, error } = await createAdminClient()
      .from("ebook_listings")
      .select("*")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Book not found.", "NOT_FOUND");
    return apiSuccess({ book: data });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Edits and resubmits a listing. Ownership and review state are enforced. */
export async function PATCH(request: NextRequest, context: Context) {
  try {
    assertTrustedOrigin(request);
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required.", "UNAUTHORIZED");
    requireVerifiedSession(session.profile, session.user, {});
    const payload = await validateBody(ebookSubmissionSchema, await request.json());
    const { id } = await context.params;
    const listing = await updateEbookListing({ userId: session.user.id, listingId: id, payload });
    return apiSuccess({ listing, submitted: true, status: listing.status });
  } catch (error) {
    return handleApiError(error);
  }
}
