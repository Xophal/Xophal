import { describe, expect, it } from "vitest";
import { buildFallbackStudyPlan } from "@/lib/ai-planner";

describe("fallback study plan generation", () => {
  it("builds a structured weekly plan for a student goal", () => {
    const plan = buildFallbackStudyPlan({
      goal: "Improve algebra and physics",
      board: "CBSE",
      className: "Class 10",
      topics: ["Algebra", "Physics Basics"],
    });

    expect(plan.title).toContain("Class 10");
    expect(plan.days).toHaveLength(7);
    expect(plan.days[0]).toEqual(
      expect.objectContaining({
        day: "Day 1",
        theme: expect.any(String),
        focus: expect.any(String),
      })
    );
  });
});
