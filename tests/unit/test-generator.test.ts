import { describe, expect, it } from "vitest";
import { sectionFilterSchema } from "@/lib/engine/blueprint-schema";
import type { ResolvedSection } from "@/lib/engine/blueprint-service";
import { computeMaxMarks } from "@/lib/engine/test-generator";

function section(id: string, marksPerQuestion: number): ResolvedSection {
  return {
    id,
    title: id,
    position: 0,
    filter: sectionFilterSchema.parse({}),
    count: 2,
    marks_per_q: marksPerQuestion,
    neg_marks: 0,
    instructions: "",
    difficulty_mix: {},
  };
}

describe("computeMaxMarks", () => {
  it("uses the marks configured for each picked question's section", () => {
    const sections = [section("one-mark", 1), section("three-mark", 3)];
    const picks = [
      { sectionId: "one-mark" },
      { sectionId: "three-mark" },
      { sectionId: "three-mark" },
    ];

    expect(computeMaxMarks(sections, picks)).toBe(7);
  });

  it("returns zero when the generator picks no questions", () => {
    expect(computeMaxMarks([section("empty", 3)], [])).toBe(0);
  });
});
