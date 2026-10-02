import { NextRequest } from "next/server";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { createAdminClient } from "@/lib/supabase/admin";
import { ebookDraftRequestSchema, ebookSubmissionSchema } from "@/lib/ebooks/schema";
import { deleteDraftEbookListing, duplicateEbookListing, updateEbookListing } from "@/lib/ebooks/submit";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    assertTrustedOrigin(request);
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required.", "UNAUTHORIZED");
    requireVerifiedSession(session.profile, session.user, {});
    const { id } = await context.params;
    const listing = await duplicateEbookListing({ userId: session.user.id, listingId: id });
    return apiSuccess({ listing }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Reads one of the signed-in seller's own listings, including review notes. */
export async function GET(_request: NextRequest, context: Context) {
  try {
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required.", "UNAUTHORIZED");
    const { id } = await context.params;
    const { data, error } = await createAdminClient()
      .from("ebook_listings")
      .select("*, ebook_contributors(bio, expertise, qualification, teaching_experience, profile_image_url, website_url, location, social_links)")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Book not found.", "NOT_FOUND");
    const contributor = Array.isArray(data.ebook_contributors) ? data.ebook_contributors[0] : data.ebook_contributors;
    return apiSuccess({ book: {
      ...data,
      contributor_bio: contributor?.bio ?? null,
      contributor_expertise: contributor?.expertise ?? [],
      contributor_qualification: contributor?.qualification ?? null,
      contributor_teaching_experience: contributor?.teaching_experience ?? null,
      contributor_profile_image_url: contributor?.profile_image_url ?? null,
      contributor_website_url: contributor?.website_url ?? null,
      contributor_location: contributor?.location ?? null,
      contributor_social_links: contributor?.social_links ?? {},
    } });
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
    const requestPayload = await validateBody(ebookDraftRequestSchema, await request.json());
    const action = requestPayload.action ?? "save_draft";
    const payload = action === "submit"
      ? await validateBody(ebookSubmissionSchema, requestPayload.payload)
      : requestPayload.payload;
    const { id } = await context.params;
    const listing = await updateEbookListing({ userId: session.user.id, listingId: id, payload, action });
    return apiSuccess({ listing, submitted: action === "submit", status: listing.status });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    assertTrustedOrigin(request);
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required.", "UNAUTHORIZED");
    const { id } = await context.params;
    const result = await deleteDraftEbookListing({ userId: session.user.id, listingId: id });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
