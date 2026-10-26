import { describe, expect, it } from "vitest";
import { sanitizeBlogHtml } from "@/lib/blog-data";

describe("CMS blog HTML sanitization", () => {
  it("preserves safe markup and removes executable markup and URLs", () => {
    const sanitized = sanitizeBlogHtml(
      '<p>Safe text</p><script>alert("x")</script><a href="javascript:alert(1)">unsafe link</a>'
    );

    expect(sanitized).toContain("<p>Safe text</p>");
    expect(sanitized).toContain("unsafe link");
    expect(sanitized).not.toContain("<script");
    expect(sanitized).not.toContain("javascript:");
    expect(sanitized).not.toContain('alert("x")');
  });
});
