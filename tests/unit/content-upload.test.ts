import { describe, expect, it } from "vitest";
import { validateContentSubmission } from "@/lib/content";

describe("content upload validation", () => {
  it("accepts valid blog content payloads", () => {
    const result = validateContentSubmission({
      type: "blog",
      title: "How to prepare for JEE Main 2026",
      slug: "how-to-prepare-for-jee-main-2026",
      excerpt: "A practical 90-day plan",
      content: "This article covers a study plan and revision strategy.",
      status: "draft",
    });

    expect(result.type).toBe("blog");
    expect(result.slug).toBe("how-to-prepare-for-jee-main-2026");
    expect(result.status).toBe("draft");
  });

  it("rejects missing required content fields", () => {
    expect(() =>
      validateContentSubmission({
        type: "lesson",
        title: "",
        content: "",
      })
    ).toThrow(/title|content/i);
  });

  it("normalizes content types and status values", () => {
    const result = validateContentSubmission({
      type: "NOTE",
      title: "Trigonometry basics",
      content: "Sine, cosine, tangent explained.",
      status: "PUBLISHED",
    });

    expect(result.type).toBe("note");
    expect(result.status).toBe("published");
  });
});
