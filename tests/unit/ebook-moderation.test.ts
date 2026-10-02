import { describe, expect, it } from "vitest";
import {
  ACTION_HISTORY_LABEL,
  ACTION_TARGET_STATUS,
  EBOOK_STATUSES,
  MODERATION_ACTIONS,
  PUBLICLY_VISIBLE_STATUSES,
  REJECTION_REASONS,
  REPORT_REASONS,
  VALID_TRANSITIONS,
  assertTransition,
  buildSellerFacingReason,
  canTransition,
  isEbookStatus,
  isRejectionReason,
} from "@/lib/ebooks/moderation";
import { ebookReportSchema } from "@/lib/ebooks/schema";

describe("ebook moderation state machine", () => {
  it("exposes exactly the statuses allowed by the database CHECK constraint", () => {
    expect([...EBOOK_STATUSES].sort()).toEqual(
      ["DRAFT", "NEEDS_CHANGES", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "SUSPENDED", "UNPUBLISHED"].sort()
    );
    expect(isEbookStatus("PUBLISHED")).toBe(true);
    expect(isEbookStatus("ARCHIVED")).toBe(false);
    expect(isEbookStatus(undefined)).toBe(false);
  });

  it("allows every transition from the spec and rejects the rest", () => {
    // Spec §22 happy paths
    expect(canTransition("DRAFT", "PENDING_REVIEW")).toBe(true);
    expect(canTransition("PENDING_REVIEW", "PUBLISHED")).toBe(true);
    expect(canTransition("PENDING_REVIEW", "REJECTED")).toBe(true);
    expect(canTransition("PENDING_REVIEW", "NEEDS_CHANGES")).toBe(true);
    expect(canTransition("PUBLISHED", "SUSPENDED")).toBe(true);
    expect(canTransition("PUBLISHED", "UNPUBLISHED")).toBe(true);
    expect(canTransition("SUSPENDED", "PUBLISHED")).toBe(true);
    expect(canTransition("UNPUBLISHED", "PUBLISHED")).toBe(true);

    // Resubmission paths used by the seller flows
    expect(canTransition("NEEDS_CHANGES", "PENDING_REVIEW")).toBe(true);
    expect(canTransition("REJECTED", "PENDING_REVIEW")).toBe(true);
    expect(canTransition("PUBLISHED", "PENDING_REVIEW")).toBe(true);

    // No self-escalation or bypass
    expect(canTransition("REJECTED", "PUBLISHED")).toBe(false);
    expect(canTransition("NEEDS_CHANGES", "PUBLISHED")).toBe(false);
    expect(canTransition("DRAFT", "PUBLISHED")).toBe(false);
    expect(canTransition("SUSPENDED", "UNPUBLISHED")).toBe(false);
    expect(canTransition("SUSPENDED", "PENDING_REVIEW")).toBe(false);
    expect(canTransition("PENDING_REVIEW", "SUSPENDED")).toBe(false);
    expect(canTransition("UNPUBLISHED", "REJECTED")).toBe(false);

    // Same-status updates (metadata edits) never trip the guard
    expect(canTransition("PUBLISHED", "PUBLISHED")).toBe(true);
    expect(canTransition("DRAFT", "DRAFT")).toBe(true);

    // Unknown states fail closed
    expect(canTransition("PENDING_REVIEW", "HACKED")).toBe(false);
    expect(canTransition("NOPE", "PUBLISHED")).toBe(false);
  });

  it("keeps the transition map free of dangling target statuses", () => {
    for (const [from, targets] of Object.entries(VALID_TRANSITIONS)) {
      for (const to of targets) {
        expect(isEbookStatus(from)).toBe(true);
        expect(isEbookStatus(to)).toBe(true);
      }
    }
  });

  it("maps every moderation action to its target status and audit label", () => {
    expect(ACTION_TARGET_STATUS.approve).toBe("PUBLISHED");
    expect(ACTION_TARGET_STATUS.reject).toBe("REJECTED");
    expect(ACTION_TARGET_STATUS.request_changes).toBe("NEEDS_CHANGES");
    expect(ACTION_TARGET_STATUS.suspend).toBe("SUSPENDED");
    expect(ACTION_TARGET_STATUS.unpublish).toBe("UNPUBLISHED");
    expect(ACTION_TARGET_STATUS.reinstate).toBe("PUBLISHED");
    expect(ACTION_TARGET_STATUS.feature).toBeNull();
    expect(ACTION_TARGET_STATUS.unfeature).toBeNull();
    expect(ACTION_TARGET_STATUS.note).toBeNull();

    for (const action of MODERATION_ACTIONS) {
      expect(ACTION_HISTORY_LABEL[action]).toBeTruthy();
    }
    expect(MODERATION_ACTIONS).toHaveLength(9);
  });

  it("throws on illegal transitions via assertTransition", () => {
    expect(() => assertTransition("PENDING_REVIEW", "PUBLISHED")).not.toThrow();
    expect(() => assertTransition("REJECTED", "PUBLISHED")).toThrow(/INVALID_TRANSITION/);
  });

  it("treats only PUBLISHED as publicly visible (mirrors RLS)", () => {
    expect([...PUBLICLY_VISIBLE_STATUSES]).toEqual(["PUBLISHED"]);
    for (const status of EBOOK_STATUSES) {
      const publicOnly = PUBLICLY_VISIBLE_STATUSES.includes(status);
      expect(publicOnly).toBe(status === "PUBLISHED");
    }
  });
});

describe("ebook moderation reasons", () => {
  it("offers the nine predefined rejection reasons from the spec", () => {
    expect(REJECTION_REASONS).toHaveLength(9);
    expect(REJECTION_REASONS).toContain("Copyright concern");
    expect(REJECTION_REASONS).toContain("Duplicate listing");
    expect(REJECTION_REASONS).toContain("Other");
    expect(isRejectionReason("Copyright concern")).toBe(true);
    expect(isRejectionReason("Because I said so")).toBe(false);
  });

  it("offers the six reader report reasons stored by the database", () => {
    expect([...REPORT_REASONS].sort()).toEqual(
      ["broken_link", "copyright", "fraud", "inappropriate", "misleading", "other"].sort()
    );
    // Must stay in sync with ebookReportSchema and the ebook_reports CHECK constraint.
    expect([...ebookReportSchema.shape.reason.options].sort()).toEqual([...REPORT_REASONS].sort());
  });

  it("builds a seller-facing reason with an optional appended note", () => {
    expect(buildSellerFacingReason("Incorrect category")).toBe("Incorrect category.");
    expect(buildSellerFacingReason("Incorrect category", "Move it to Board Exams.")).toBe(
      "Incorrect category. Move it to Board Exams."
    );
    expect(buildSellerFacingReason("Other", "   ")).toBe("Other.");
  });
});
