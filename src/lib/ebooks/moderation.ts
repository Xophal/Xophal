/**
 * eBook moderation domain: statuses, allowed transitions, actions and the
 * predefined rejection reasons. Shared by the admin API routes and the UI so
 * client and server agree on the state machine, and unit-testable in isolation.
 *
 * The same transition map is enforced a second time inside Postgres by the
 * `enforce_ebook_status_transition` trigger (migration 034), so a compromised
 * or buggy server handler still cannot publish an unreviewed listing.
 */

export const EBOOK_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "REJECTED",
  "SUSPENDED",
  "NEEDS_CHANGES",
  "UNPUBLISHED",
] as const;

export type EbookStatus = (typeof EBOOK_STATUSES)[number];

/** Statuses the public marketplace may ever render (RLS mirrors this). */
export const PUBLICLY_VISIBLE_STATUSES: readonly EbookStatus[] = ["PUBLISHED"];

/**
 * Exhaustive map of legal status changes (spec §22). Anything not listed is
 * rejected by both the API layer and the database trigger.
 */
export const VALID_TRANSITIONS: Record<EbookStatus, readonly EbookStatus[]> = {
  DRAFT: ["PENDING_REVIEW"],
  PENDING_REVIEW: ["PUBLISHED", "REJECTED", "NEEDS_CHANGES"],
  NEEDS_CHANGES: ["PENDING_REVIEW"],
  REJECTED: ["PENDING_REVIEW"],
  PUBLISHED: ["PENDING_REVIEW", "SUSPENDED", "UNPUBLISHED"],
  SUSPENDED: ["PUBLISHED"],
  UNPUBLISHED: ["PUBLISHED"],
};

export function isEbookStatus(value: unknown): value is EbookStatus {
  return typeof value === "string" && (EBOOK_STATUSES as readonly string[]).includes(value);
}

/** True when the transition is legal or when the status is unchanged. */
export function canTransition(from: unknown, to: unknown): boolean {
  if (!isEbookStatus(from) || !isEbookStatus(to)) return false;
  if (from === to) return true;
  return VALID_TRANSITIONS[from].includes(to);
}

/** Admin moderation actions accepted by PATCH /api/admin/ebooks/[ebookId]. */
export const MODERATION_ACTIONS = [
  "approve",
  "reject",
  "request_changes",
  "suspend",
  "unpublish",
  "reinstate",
  "feature",
  "unfeature",
  "note",
] as const;

export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

/** Action → the status it moves the listing to (null = no status change). */
export const ACTION_TARGET_STATUS: Record<ModerationAction, EbookStatus | null> = {
  approve: "PUBLISHED",
  reject: "REJECTED",
  request_changes: "NEEDS_CHANGES",
  suspend: "SUSPENDED",
  unpublish: "UNPUBLISHED",
  reinstate: "PUBLISHED",
  feature: null,
  unfeature: null,
  note: null,
};

/** Action → the audit-trail label written to ebook_moderation_history. */
export const ACTION_HISTORY_LABEL: Record<ModerationAction, string> = {
  approve: "APPROVED",
  reject: "REJECTED",
  request_changes: "CHANGES_REQUESTED",
  suspend: "SUSPENDED",
  unpublish: "UNPUBLISHED",
  reinstate: "RESTORED",
  feature: "FEATURED",
  unfeature: "UNFEATURED",
  note: "NOTE",
};

/** Spec §11: predefined rejection reasons offered to the reviewer. */
export const REJECTION_REASONS = [
  "Copyright concern",
  "Incomplete information",
  "Misleading information",
  "Incorrect category",
  "Invalid external URL",
  "Poor-quality content presentation",
  "Inappropriate content",
  "Duplicate listing",
  "Other",
] as const;

export type RejectionReason = (typeof REJECTION_REASONS)[number];

export function isRejectionReason(value: unknown): value is RejectionReason {
  return typeof value === "string" && (REJECTION_REASONS as readonly string[]).includes(value);
}

/**
 * Spec §27: reasons readers may pick when reporting a published eBook.
 * Values must match the `ebook_reports.reason` CHECK constraint (migration 026)
 * and `ebookReportSchema`; "fraud" is the stored value for the "Spam" label.
 */
export const REPORT_REASONS = [
  "copyright",
  "inappropriate",
  "misleading",
  "fraud",
  "broken_link",
  "other",
] as const;

/**
 * Builds the rejection message persisted for the seller. Structured reason
 * first, optional admin note appended so the seller always sees guidance.
 */
export function buildSellerFacingReason(reason: string, note?: string | null): string {
  const trimmedNote = (note ?? "").trim();
  return trimmedNote ? `${reason}. ${trimmedNote}` : `${reason}.`;
}

/** Server-side guard mirroring the DB trigger; throws-shaped result for APIs. */
export function assertTransition(from: EbookStatus, to: EbookStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`INVALID_TRANSITION: ${from} -> ${to}`);
  }
}
