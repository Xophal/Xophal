import { z } from "zod";

const httpUrl = z.string().trim().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "Enter a valid HTTP or HTTPS URL.");
const httpsUrl = z.string().trim().url().refine((value) => new URL(value).protocol === "https:", "Enter a valid HTTPS URL.");

export const ebookSubmissionSchema = z.object({
  title: z.string().trim().min(3).max(240),
  authorName: z.string().trim().min(2).max(160),
  shortDescription: z.string().trim().min(20).max(500),
  fullDescription: z.string().trim().min(30).max(12000),
  categoryId: z.string().uuid(),
  subjectId: z.string().uuid().optional().or(z.literal("")),
  examId: z.string().uuid().optional().or(z.literal("")),
  subject: z.string().trim().max(160).optional().or(z.literal("")),
  exam: z.string().trim().max(160).optional().or(z.literal("")),
  language: z.string().trim().min(2).max(80),
  pageCount: z.number().int().positive().max(10000).optional().nullable(),
  price: z.number().min(0).max(100000).finite(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  coverImageUrl: httpUrl,
  externalProductUrl: httpUrl,
  previewUrl: httpUrl.optional().or(z.literal("")),
  publicationDate: z.string().date().optional().or(z.literal("")),
  contributorBio: z.string().trim().max(2000).optional().or(z.literal("")),
  contributorExpertise: z.array(z.string().trim().min(2).max(80)).max(12).default([]),
  contributorQualification: z.string().trim().max(240).optional().or(z.literal("")),
  contributorTeachingExperience: z.string().trim().max(500).optional().or(z.literal("")),
  contributorProfileImageUrl: httpsUrl.optional().or(z.literal("")),
  contributorWebsiteUrl: httpsUrl.optional().or(z.literal("")),
  contributorLocation: z.string().trim().max(120).optional().or(z.literal("")),
  contributorSocialLinks: z.record(z.string().trim().min(1).max(40), httpsUrl).optional().default({}),
  rightsConfirmed: z.literal(true),
});

export const ebookDraftSchema = ebookSubmissionSchema.partial().extend({
  title: z.string().trim().max(240).optional().or(z.literal("")),
  authorName: z.string().trim().max(160).optional().or(z.literal("")),
  shortDescription: z.string().trim().max(500).optional().or(z.literal("")),
  fullDescription: z.string().trim().max(12000).optional().or(z.literal("")),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  language: z.string().trim().max(80).optional().or(z.literal("")),
  price: z.number().min(0).max(100000).finite().optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  coverImageUrl: httpUrl.optional().or(z.literal("")),
  externalProductUrl: httpUrl.optional().or(z.literal("")),
  previewUrl: httpUrl.optional().or(z.literal("")),
  contributorBio: z.string().trim().max(2000).optional().or(z.literal("")),
  contributorQualification: z.string().trim().max(240).optional().or(z.literal("")),
  contributorTeachingExperience: z.string().trim().max(500).optional().or(z.literal("")),
  contributorProfileImageUrl: httpsUrl.optional().or(z.literal("")),
  contributorWebsiteUrl: httpsUrl.optional().or(z.literal("")),
  contributorLocation: z.string().trim().max(120).optional().or(z.literal("")),
  contributorSocialLinks: z.record(z.string().trim().min(1).max(40), httpsUrl).optional(),
  rightsConfirmed: z.boolean().optional(),
});

export const ebookSubmissionActionSchema = z.enum(["save_draft", "submit"]);
export const ebookDraftRequestSchema = z.object({
  action: ebookSubmissionActionSchema.optional(),
  payload: ebookDraftSchema,
});

export const ebookReportSchema = z.object({
  ebookId: z.string().uuid(),
  reason: z.enum(["copyright", "misleading", "broken_link", "inappropriate", "fraud", "other"]),
  details: z.string().trim().min(10).max(2000),
});

export const ebookEventSchema = z.object({
  eventName: z.enum([
    "ebook_view", "ebook_search", "ebook_listing_submit", "ebook_approved",
    "ebook_rejected", "ebook_external_click", "ebook_purchase_started",
    "ebook_purchase_completed", "mock_test_from_ebook", "mock_test_started",
    "mock_test_completed", "author_profile_view",
    "seller_profile_view", "ebook_created", "ebook_submitted", "ebook_resubmitted",
  ]),
  ebookId: z.string().uuid().optional(),
  source: z.string().trim().max(100).optional(),
  metadata: z.record(z.unknown()).optional().default({}),
});

export function slugifyEbookTitle(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 220);
}

export {
  DEFAULT_PRICING_RULES,
  computeOrderSettlement,
  estimateSellerEarnings,
  roundMoney,
  splitVerifiedSale,
  suggestedRangeForPrice,
  validatePriceOffering,
} from "@/lib/ebooks/pricing";
export type { MarketplacePricingRules, PriceRange, PriceValidation, SellerEarningsEstimate } from "@/lib/ebooks/pricing";

/** Order statuses the client may never set directly. */
export const EBOOK_ORDER_STATUSES = ["CREATED", "PAID", "FULFILLED", "REFUNDED", "CANCELLED"] as const;
export const EBOOK_PAYOUT_STATUSES = ["NOT_AVAILABLE", "PENDING", "AVAILABLE", "PROCESSING", "PAID", "FAILED"] as const;

export const ebookCheckoutSchema = z.object({
  ebookId: z.string().uuid(),
});

export const ebookPurchaseVerificationSchema = z.object({
  ebookId: z.string().uuid(),
  razorpay_order_id: z.string().min(1).max(200),
  razorpay_payment_id: z.string().min(1).max(200),
  razorpay_signature: z.string().min(1).max(400),
});

export const ebookPayoutOnboardingSchema = z.object({
  legalBusinessName: z.string().trim().min(4).max(200),
  businessType: z.literal("individual"),
  pan: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/),
  gst: z.string().trim().toUpperCase().regex(/^[0-9A-Z]{15}$/).optional().or(z.literal("")),
  phone: z.string().trim().regex(/^\+?[0-9]{8,15}$/),
  tncAccepted: z.literal(true),
  settlementAccount: z.discriminatedUnion("method", [
    z.object({
      method: z.literal("bank_account"),
      accountNumber: z.string().trim().regex(/^[0-9]{5,20}$/),
      beneficiaryName: z.string().trim().min(2).max(160),
      ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/),
    }),
    z.object({
      method: z.literal("upi"),
      vpa: z.string().trim().regex(/^[A-Za-z0-9._-]{2,}@[A-Za-z0-9.-]{2,}$/),
      beneficiaryName: z.string().trim().min(2).max(160),
    }),
  ]),
});

export const ebookReportSchemaReasonEnum = [
  "copyright",
  "misleading",
  "broken_link",
  "inappropriate",
  "fraud",
  "other",
] as const;

/** Admin-editable marketplace configuration (commission + pricing rules). */
export const ebookMarketplaceConfigSchema = z.object({
  commissionPercent: z.number().min(0).max(100).finite(),
  minPrice: z.number().min(0).max(1000000).finite(),
  maxPrice: z.number().min(0).max(1000000).finite(),
  allowFree: z.boolean(),
  allowedCurrencies: z.array(z.string().trim().length(3)).min(1).max(8),
  paymentFeePercent: z.number().min(0).max(100).finite(),
  taxPercent: z.number().min(0).max(100).finite(),
  payoutHoldDays: z.number().int().min(0).max(365),
  suggestedRanges: z
    .array(z.object({ label: z.string().trim().min(2).max(80), min: z.number().min(0), max: z.number().min(0) }))
    .max(12),
}).refine((value) => value.maxPrice >= value.minPrice, {
  message: "Maximum price must be greater than or equal to the minimum price.",
});
