import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import { buildFallbackStudyPlan, generateStudyPlan } from "@/lib/ai-planner";

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
    expect(plan.source).toBe("template");
  });

  it("uses the template when no provider key is configured", async () => {
    const plan = await generateStudyPlan({ goal: "Improve algebra" }, { apiKey: "" });

    expect(plan.source).toBe("template");
    expect(plan.days[3].focus).not.toContain("undefined");
  });

  it("returns validated seven-day content from the configured provider", async () => {
    const planContent = {
      title: "Algebra practice plan",
      summary: "A balanced week of revision and practice.",
      days: Array.from({ length: 7 }, (_, index) => ({
        day: `Day ${index + 1}`,
        theme: "Practice",
        focus: "Review linear equations and solve a short problem set.",
        durationMinutes: 45,
      })),
    };
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(planContent) } }],
    });
    const client = { chat: { completions: { create } } } as unknown as OpenAI;

    const plan = await generateStudyPlan(
      { goal: "Improve algebra", topics: ["Linear equations"] },
      { apiKey: "configured", model: "test-model", client }
    );

    expect(plan).toEqual({ ...planContent, source: "openai" });
    expect(create).toHaveBeenCalledOnce();
  });

  it("falls back when provider output does not match the plan schema", async () => {
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: "{}" } }] });
    const client = { chat: { completions: { create } } } as unknown as OpenAI;

    const plan = await generateStudyPlan(
      { goal: "Improve algebra" },
      { apiKey: "configured", client }
    );

    expect(plan.source).toBe("template");
  });

  it("falls back when the provider request fails", async () => {
    const create = vi.fn().mockRejectedValue(new Error("provider unavailable"));
    const client = { chat: { completions: { create } } } as unknown as OpenAI;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const plan = await generateStudyPlan(
      { goal: "Improve algebra" },
      { apiKey: "configured", client }
    );

    expect(plan.source).toBe("template");
    warn.mockRestore();
  });
});
