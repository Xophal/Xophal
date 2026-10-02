import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ApiError } from "@/lib/api-utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { getMarketplaceConfig } from "@/lib/ebooks/config";
import { validatePriceOffering, type MarketplacePricingRules } from "@/lib/ebooks/pricing";
import { ebookDraftSchema, slugifyEbookTitle } from "@/lib/ebooks/schema";

/**
 * Input shape (not `z.output`) because `validateBody` accepts `ZodSchema<T>` and
 * therefore infers the pre-parse type; defaulted fields stay optional here and
 * are normalised with `??` fallbacks before persisting.
 */
export type EbookDraftInput = z.input<typeof ebookDraftSchema>;

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
  contributorId: string | null;
  fields: Record<string, unknown>;
};

/**
 * Validates a submission against live marketplace rules and returns the column
 * values to persist. Sellers can never set status, review fields, or money
 * totals through this path.
 */
async function prepareListing(input: {
  userId: string;
  payload: EbookDraftInput;
  config: MarketplacePricingRules;
  validateForSubmission: boolean;
}): Promise<PreparedListing> {
  const { userId, payload, config, validateForSubmission } = input;
  const admin = createAdminClient();

  const productUrl = payload.externalProductUrl ? assertHttpsUrl(payload.externalProductUrl, "External fulfilment link") : null;
  const previewUrl = payload.previewUrl ? assertHttpsUrl(payload.previewUrl, "Preview link").toString() : null;
  const coverUrl = payload.coverImageUrl ? assertManagedCoverUrl(payload.coverImageUrl) : null;

  if (validateForSubmission) {
    const priceCheck = validatePriceOffering({ price: payload.price ?? 0, currency: payload.currency ?? "INR", rules: config });
    if (!priceCheck.ok) throw new ApiError(400, priceCheck.error, "INVALID_PRICE");
  }

  const [categoryResult, subjectResult, examResult] = await Promise.all([
    payload.categoryId
      ? admin.from("ebook_categories").select("id").eq("id", payload.categoryId).eq("is_active", true).maybeSingle()
      : Promise.resolve({ data: null }),
    payload.subjectId
      ? admin.from("subjects").select("id, name").eq("id", payload.subjectId).eq("is_active", true).maybeSingle()
      : Promise.resolve({ data: null }),
    payload.examId
      ? admin.from("exams").select("id, name").eq("id", payload.examId).eq("is_active", true).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (validateForSubmission && !categoryResult.data) throw new ApiError(400, "Select an active category.", "INVALID_CATEGORY");
  if (payload.subjectId && !subjectResult.data) throw new ApiError(400, "Select an active subject.", "INVALID_SUBJECT");
  if (payload.examId && !examResult.data) throw new ApiError(400, "Select an active exam.", "INVALID_EXAM");

  let contributorId: string | null = null;
  if (payload.authorName) {
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
          qualification: payload.contributorQualification || null,
          teaching_experience: payload.contributorTeachingExperience || null,
          profile_image_url: payload.contributorProfileImageUrl || null,
          website_url: payload.contributorWebsiteUrl || null,
          location: payload.contributorLocation || null,
          social_links: payload.contributorSocialLinks ?? {},
        },
        { onConflict: "user_id" }
      )
      .select("id")
      .single();
    if (contributorError) throw contributorError;
    contributorId = contributor.id;
  }

  return {
    contributorId,
    fields: {
      contributor_id: contributorId,
      category_id: payload.categoryId || null,
      subject_id: payload.subjectId || null,
      exam_id: payload.examId || null,
      title: payload.title || null,
      cover_image_url: coverUrl?.toString() ?? null,
      short_description: payload.shortDescription || null,
      full_description: payload.fullDescription || null,
      subject: payload.subject || subjectResult.data?.name || null,
      exam: payload.exam || examResult.data?.name || null,
      language: payload.language || null,
      page_count: payload.pageCount ?? null,
      price: payload.price ?? 0,
      currency: payload.currency ?? "INR",
      external_product_url: productUrl?.toString() ?? null,
      preview_url: previewUrl,
      author_name: payload.authorName || null,
      publication_date: payload.publicationDate || null,
    },
  };
}

export type CreatedEbookListing = { id: string; slug: string; status: string };

/** Creates either a saved draft or a complete review submission. */
export async function createEbookListing(input: {
  userId: string;
  payload: EbookDraftInput;
  action: "save_draft" | "submit";
}): Promise<CreatedEbookListing> {
  const admin = createAdminClient();
  const config = await getMarketplaceConfig();
  const submitted = input.action === "submit";
  const prepared = await prepareListing({ userId: input.userId, payload: input.payload, config, validateForSubmission: submitted });
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("ebook_listings")
    .insert({
      ...prepared.fields,
      user_id: input.userId,
      slug: `${slugifyEbookTitle(input.payload.title || "draft") || "draft"}-${randomUUID().slice(0, 8)}`,
      status: submitted ? "PENDING_REVIEW" : "DRAFT",
      submitted_at: submitted ? now : null,
      rejection_reason: null,
      admin_review_note: null,
      rights_confirmed: submitted && input.payload.rightsConfirmed === true,
      rights_confirmed_at: submitted && input.payload.rightsConfirmed === true ? now : null,
      updated_at: now,
    })
    .select("id, slug, status")
    .single();
  if (error) throw error;

  await admin.from("ebook_events").insert({
    event_name: "ebook_created",
    ebook_id: data.id,
    user_id: input.userId,
    source: "seller_form",
  });

  if (submitted) {
    await admin.from("ebook_events").insert({
      event_name: "ebook_listing_submit",
      ebook_id: data.id,
      user_id: input.userId,
      source: "seller_form",
    });
    await admin.from("ebook_events").insert({
      event_name: "ebook_submitted",
      ebook_id: data.id,
      user_id: input.userId,
      source: "seller_form",
    });
    await admin.from("ebook_moderation_history").insert({
      ebook_id: data.id,
      admin_id: input.userId,
      previous_status: "DRAFT",
      new_status: "PENDING_REVIEW",
      action: "SUBMITTED",
    });
  }

  return data as CreatedEbookListing;
}
/**
 * Saves an owned draft or resubmits an edited listing. Pending and suspended
 * listings cannot be changed by sellers.
 */
export async function updateEbookListing(input: {
  userId: string;
  listingId: string;
  payload: EbookDraftInput;
  action: "save_draft" | "submit";
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
  if (existing.status === "PENDING_REVIEW") {
    throw new ApiError(409, "This listing is under review and cannot be edited.", "LISTING_UNDER_REVIEW");
  }
  if (["SUSPENDED", "UNPUBLISHED"].includes(existing.status)) {
    throw new ApiError(403, "This listing cannot be edited. Contact Xophol support.", "LISTING_LOCKED");
  }
  if (input.action === "save_draft" && !["DRAFT", "REJECTED", "NEEDS_CHANGES"].includes(existing.status)) {
    throw new ApiError(409, "Only draft or rejected listings can be saved without submission.", "INVALID_LISTING_STATE");
  }

  const config = await getMarketplaceConfig();
  const submitted = input.action === "submit";
  const prepared = await prepareListing({ userId: input.userId, payload: input.payload, config, validateForSubmission: submitted });
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("ebook_listings")
    .update({
      ...prepared.fields,
      status: submitted ? "PENDING_REVIEW" : existing.status,
      submitted_at: submitted ? now : undefined,
      rejection_reason: submitted ? null : undefined,
      seller_feedback: submitted ? null : undefined,
      reviewed_by: submitted ? null : undefined,
      reviewed_at: submitted ? null : undefined,
      approved_at: submitted ? null : undefined,
      published_at: submitted ? null : undefined,
      suspended_at: submitted ? null : undefined,
      rights_confirmed: submitted && input.payload.rightsConfirmed === true,
      rights_confirmed_at: submitted && input.payload.rightsConfirmed === true ? now : null,
      updated_at: now,
    })
    .eq("id", input.listingId)
    .eq("user_id", input.userId)
    .select("id, slug, status")
    .single();
  if (error) throw error;

  if (submitted) {
    await admin.from("ebook_events").insert({
      event_name: "ebook_listing_submit",
      ebook_id: data.id,
      user_id: input.userId,
      source: "seller_resubmission",
    });
    await admin.from("ebook_events").insert({
      event_name: existing.status === "DRAFT" ? "ebook_submitted" : "ebook_resubmitted",
      ebook_id: data.id,
      user_id: input.userId,
      source: "seller_form",
    });
    await admin.from("ebook_moderation_history").insert({
      ebook_id: data.id,
      admin_id: input.userId,
      previous_status: existing.status,
      new_status: "PENDING_REVIEW",
      action: "RESUBMITTED",
      reason: existing.status === "REJECTED" ? "Seller resubmitted after rejection" : existing.status === "NEEDS_CHANGES" ? "Seller resubmitted after requested changes" : null,
    });
  }

  return data as CreatedEbookListing;
}

export async function duplicateEbookListing(input: { userId: string; listingId: string }): Promise<CreatedEbookListing> {
  const admin = createAdminClient();
  const { data: source, error: readError } = await admin
    .from("ebook_listings")
    .select("user_id, contributor_id, category_id, subject_id, exam_id, title, cover_image_url, short_description, full_description, subject, exam, language, page_count, price, currency, external_product_url, preview_url, author_name, publication_date, status")
    .eq("id", input.listingId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (readError) throw readError;
  if (!source) throw new ApiError(404, "Book not found.", "NOT_FOUND");
  if (["PENDING_REVIEW", "SUSPENDED", "UNPUBLISHED"].includes(source.status)) {
    throw new ApiError(409, "This listing cannot be duplicated in its current state.", "LISTING_LOCKED");
  }

  const { data, error } = await admin.from("ebook_listings").insert({
    ...source,
    user_id: input.userId,
    slug: `${slugifyEbookTitle(source.title || "draft") || "draft"}-${randomUUID().slice(0, 8)}`,
    status: "DRAFT",
    is_featured: false,
    rejection_reason: null,
    seller_feedback: null,
    admin_review_note: null,
    internal_moderation_reason: null,
    rights_confirmed: false,
    rights_confirmed_at: null,
    submitted_at: null,
    reviewed_by: null,
    reviewed_at: null,
    approved_at: null,
    published_at: null,
    suspended_at: null,
    view_count: 0,
    external_click_count: 0,
    updated_at: new Date().toISOString(),
  }).select("id, slug, status").single();
  if (error) throw error;
  return data as CreatedEbookListing;
}

export async function deleteDraftEbookListing(input: { userId: string; listingId: string }) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("ebook_listings")
    .delete()
    .eq("id", input.listingId)
    .eq("user_id", input.userId)
    .eq("status", "DRAFT")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(409, "Only your own drafts can be deleted.", "DRAFT_DELETE_NOT_ALLOWED");
  return { deleted: true };
}
