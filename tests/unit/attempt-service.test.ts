import { describe, expect, it } from "vitest";

import { planForOpenAttempt, SUBMIT_GRACE_SEC } from "@/lib/engine/attempt-service";

/**
 * The resume/expire decision is the one piece of attempt lifecycle that has to be
 * right offline: it decides whether a student who refreshes gets their same
 * frozen paper back, or silently loses it.
 */
const NOW = new Date("2026-09-25T12:00:00.000Z").getTime();
const at = (offsetSec: number) => new Date(NOW + offsetSec * 1000).toISOString();

describe("planForOpenAttempt", () => {
  it("resumes an attempt that is comfortably inside its deadline", () => {
    expect(planForOpenAttempt("in_progress", at(600), NOW)).toBe("resume");
  });

  it("resumes right up to the deadline", () => {
    expect(planForOpenAttempt("in_progress", at(1), NOW)).toBe("resume");
  });

  it("keeps resuming inside the grace window", () => {
    const past = -10; // 10s past the deadline
    expect(planForOpenAttempt("in_progress", at(past), NOW)).toBe("resume");
    expect(SUBMIT_GRACE_SEC).toBeGreaterThan(10);
  });

  it("expires once the grace window has passed", () => {
    expect(planForOpenAttempt("in_progress", at(-SUBMIT_GRACE_SEC - 1), NOW)).toBe("expire");
  });

  it("starts fresh when nothing is open", () => {
    expect(planForOpenAttempt(null, null, NOW)).toBe("new");
  });

  it("starts fresh when the previous attempt is already finished", () => {
    for (const status of ["submitted", "graded", "expired"]) {
      expect(planForOpenAttempt(status, at(600), NOW), status).toBe("new");
    }
  });

  it("does not resume an attempt that was left open with no deadline", () => {
    expect(planForOpenAttempt("in_progress", null, NOW)).toBe("new");
  });
});
