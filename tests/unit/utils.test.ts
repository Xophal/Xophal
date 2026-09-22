import { describe, expect, it } from "vitest";
import { calculatePercentage, formatDuration, getLevelFromXP, getXPForNextLevel, slugify } from "@/lib/utils";

describe("learning utility calculations", () => {
  it("calculates scores without dividing by zero", () => {
    expect(calculatePercentage(7, 8)).toBe(87.5);
    expect(calculatePercentage(1, 0)).toBe(0);
  });

  it("keeps level and XP thresholds consistent", () => {
    expect(getLevelFromXP(0)).toBe(1);
    expect(getLevelFromXP(400)).toBe(3);
    expect(getXPForNextLevel(3)).toBe(900);
  });

  it("formats durations and URL slugs", () => {
    expect(formatDuration(3661)).toBe("1h 1m");
    expect(slugify("  CBSE Class 10: Maths! ")).toBe("cbse-class-10-maths");
  });
});
