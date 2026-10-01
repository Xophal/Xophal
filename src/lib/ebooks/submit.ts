import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ApiError } from "@/lib/api-utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { getMarketplaceConfig } from "@/lib/ebooks/config";
import { validatePriceOffering, type MarketplacePricingRules } from "@/lib/ebooks/pricing";
import { ebookSubmissionSchema, slugifyEbookTitle } from "@/lib/ebooks/schema";

/**
 * Input shape (not `z.output`) because `validateBody` accepts `ZodSchema<T>` and
 * therefore infers the pre-parse type; defaulted fields stay optional here and
 * are normalised with `??` fallbacks before persisting.
 */
export type EbookSubmissionInput = z.input<typeof ebookSubmissionSchema>;

function assertHttpsUrl(value: string, label: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ApiError(400, `${label} must be a valid URL.`, "VALIDATION_ERROR");
  }
  if (parsed.protocol !== "https:") {
    throw new ApiError(400, `${label} must use HTTPS.`, "VALIDATION_ERROR");
  }
  return parsed;
}

/** Cover images must be uploaded through /api/ebooks/cover first. */
function assertManagedCoverUrl(value: string) {
  const parsed = assertHttpsUrl(value, "Cover image URL");
  let storageOrigin = "";
  try {
    storageOrigin = new URL(publicEnv.NEXT_PUBLIC_SUPABASE_URL).origin;
  } catch {
    storageOrigin = "";
  }
  const isManaged =
    storageOrigin !== "" &&
    parsed.origin === storageOrigin &&
    parsed.pathname.includes("/storage/v1/object/public/") &&
    parsed.pathname.includes("/ebook-covers/");
  if (!isManaged) {
    throw new ApiError(400, "Upload the cover image before submitting this listing.", "INVALID_COVER_URL");
  }
  return parsed;
}

type PreparedListing = {
  contributorId: string;
  fields: Record<string, unknown>;
};

/**
 * Validates a submission against live marketplace rules and returns the column
 * values to persist. Sellers can never set status, review fields, or money
 * totals through this path.
 */
async function prepareListing(input: {
  userId: string;
  payload: EbookSubmissionInput;
  config: MarketplacePricingRules;
}): Promise<PreparedListing> {
  const { userId, payload, config } = input;
  const admin = createAdminClient();

  const productUrl = assertHttpsUrl(payload.externalProductUrl, "External fulfilment link");
  const previewUrl = payload.previewUrl ? assertHttpsUrl(payload.previewUrl, "Preview link").toString() : null;
  const coverUrl = assertManagedCoverUrl(payload.coverImageUrl);

  const priceCheck = validatePriceOffering({ price: payload.price, currency: payload.currency, rules: config });
  if (!priceCheck.ok) throw new ApiError(400, priceCheck.error, "INVALID_PRICE");

  const [categoryResult, subjectResult, examResult] = await Promise.all([
    admin.from("ebook_categories").select("id").eq("id", payload.categoryId).eq("is_active", true).maybeSingle(),
    payload.subjectId
      ? admin.from("subjects").select("id, name").eq("id", payload.subjectId).eq("is_active", true).maybeSingle()
      : Promise.resolve({ data: null }),
    payload.examId
      ? admin.from("exams").select("id, name").eq("id", payload.examId).eq("is_active", true).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!categoryResult.data) throw new ApiError(400, "Select an active category.", "INVALID_CATEGORY");
  if (payload.subjectId && !subjectResult.data) throw new ApiError(400, "Select an active subject.", "INVALID_SUBJECT");
  if (payload.examId && !examResult.data) throw new ApiError(400, "Select an active exam.", "INVALID_EXAM");

  const authorSlug = `${slugifyEbookTitle(payload.authorName) || "educator"}-${userId.slice(0, 8)}`;
  const { data: contributor, error: contributorError } = await admin
    .from("ebook_contributors")
    .upsert(
      {
        user_id: userId,
        slug: authorSlug,
        display_name: payload.authorName,
        bio: payload.contributorBio || null,
        expertise: payload.contributorExpertise ?? [],
      },
      { onConflict: "user_id" }
    )
    .select("id")
    .single();
  if (contributorError) throw contributorError;

  return {
    contributorId: contributor.id,
    fields: {
      contributor_id: contributor.id,
      category_id: payload.categoryId,
      subject_id: payload.subjectId || null,
      exam_id: payload.examId || null,
      title: payload.title,
      cover_image_url: coverUrl.toString(),
      short_description: payload.shortDescription,
      full_description: payload.fullDescription,
      subject: payload.subject || subjectResult.data?.name || null,
      exam: payload.exam || examResult.data?.name || null,
      language: payload.language,
      page_count: payload.pageCount ?? null,
      price: payload.price,
      currency: payload.currency,
      external_product_url: productUrl.toString(),
      preview_url: previewUrl,
      author_name: payload.authorName,
      publication_date: payload.publicationDate || null,
    },
  };
}

export type CreatedEbookListing = { id: string; slug: string; status: string };

/** Creates a listing. Listings are free and always enter review. */
export async function createEbookListing(input: {
  userId: string;
  payload: EbookSubmissionInput;
}): Promise<CreatedEbookListing> {
  const admin = createAdminClient();
  const config = await getMarketplaceConfig();
  const prepared = await prepareListing({ userId: input.userId, payload: input.payload, config });
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("ebook_listings")
    .insert({
      ...prepared.fields,
      user_id: input.userId,
      slug: `${slugifyEbookTitle(input.payload.title) || "ebook"}-${randomUUID().slice(0, 8)}`,
      status: "PENDING_REVIEW",
      submitted_at: now,
      rejection_reason: null,
      admin_review_note: null,
      rights_confirmed: true,
      rights_confirmed_at: now,
      updated_at: now,
    })
    .select("id, slug, status")
    .single();
  if (error) throw error;

  await admin.from("ebook_events").insert({
    event_name: "ebook_listing_submit",
    ebook_id: data.id,
    user_id: input.userId,
    source: "seller_form",
  });

  return data as CreatedEbookListing;
}
/**
 * Edits or resubmits an existing listing. Ownership is enforced here; the row is
 * always returned to PENDING_REVIEW so an edited listing cannot stay public
 * without a fresh moderation pass.
 */
export async function updateEbookListing(input: {
  userId: string;
  listingId: string;
  payload: EbookSubmissionInput;
}): Promise<CreatedEbookListing> {
  const admin = createAdminClient();
  const { data: existing, error: readError } = await admin
    .from("ebook_listings")
    .select("id, user_id, slug, status")
    .eq("id", input.listingId)
    .maybeSingle();
  if (readError) throw readError;
  if (!existing || existing.user_id !== input.userId) {
    throw new ApiError(404, "Book not found.", "NOT_FOUND");
  }
  if (existing.status === "SUSPENDED") {
    throw new ApiError(403, "A suspended listing cannot be edited. Contact Xophol support.", "LISTING_SUSPENDED");
  }

  const config = await getMarketplaceConfig();
  const prepared = await prepareListing({ userId: input.userId, payload: input.payload, config });
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("ebook_listings")
    .update({
      ...prepared.fields,
      status: "PENDING_REVIEW",
      submitted_at: now,
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
      approved_at: null,
      published_at: null,
      suspended_at: null,
      rights_confirmed: true,
      rights_confirmed_at: now,
      updated_at: now,
    })
    .eq("id", input.listingId)
    .eq("user_id", input.userId)
    .select("id, slug, status")
    .single();
  if (error) throw error;

  await admin.from("ebook_events").insert({
    event_name: "ebook_listing_submit",
    ebook_id: data.id,
    user_id: input.userId,
    source: "seller_resubmission",
  });

  return data as CreatedEbookListing;
}

\n