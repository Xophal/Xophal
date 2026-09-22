import { describe, expect, it } from "vitest";
import { z } from "zod";

const questionContentSchema = z.object({
  status: z.enum(["draft", "review", "approved", "published", "rejected", "archived"]),
  tags: z.array(z.string().min(1)).max(50),
  languageId: z.string().uuid().nullable(),
});

describe("question content workflow contract", () => {
  it("accepts workflow status, tags, and optional language", () => {
    expect(questionContentSchema.safeParse({ status: "review", tags: ["algebra"], languageId: null }).success).toBe(true);
  });

  it("rejects unknown workflow states", () => {
    expect(questionContentSchema.safeParse({ status: "published_now", tags: [], languageId: null }).success).toBe(false);
  });
});
