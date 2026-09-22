import { describe, expect, it } from "vitest";
import { formatTestTime, getAttemptExpiresAt, getRemainingSeconds } from "@/lib/test-timer";

describe("test timer", () => {
  it("derives a stable expiry from the start time and configured duration", () => {
    expect(getAttemptExpiresAt(1_000, 2)).toBe(121_000);
    expect(getRemainingSeconds(121_000, 1_000)).toBe(120);
    expect(getRemainingSeconds(121_000, 120_001)).toBe(1);
    expect(getRemainingSeconds(121_000, 121_000)).toBe(0);
  });

  it("rejects invalid durations and formats short and long tests", () => {
    expect(getAttemptExpiresAt(1_000, 0)).toBeNull();
    expect(getAttemptExpiresAt(1_000, Number.NaN)).toBeNull();
    expect(formatTestTime(59)).toBe("00:59");
    expect(formatTestTime(3_661)).toBe("01:01:01");
  });
});
