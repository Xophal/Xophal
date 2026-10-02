export const EBOOK_LISTING_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "REJECTED",
  "SUSPENDED",
  "UNPUBLISHED",
  "NEEDS_CHANGES",
] as const;

export type EbookListingStatus = (typeof EBOOK_LISTING_STATUSES)[number];