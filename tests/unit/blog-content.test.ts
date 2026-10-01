import { describe, expect, it } from "vitest";
import { createBlogSlug, estimateReadingMinutes, renderBlogContent } from "@/lib/blog-content";

describe("blog content helpers", () => {
  it("creates stable URL slugs from titles", () => {
    expect(createBlogSlug("A Smarter Way to Study Maths!")).toBe("a-smarter-way-to-study-maths");
  });

  it("estimates at least one minute of reading time", () => {
    expect(estimateReadingMinutes("Short post")).toBe(1);
    expect(estimateReadingMinutes("word ".repeat(400))).toBe(2);
  });

  it("renders markdown while stripping unsafe HTML and URL schemes", async () => {
    const html = await renderBlogContent(
      '# Study plan\n\n[unsafe](javascript:alert(1)) <img src=x onerror="alert(1)"><script>alert(1)</script>'
    );

    expect(html).toContain("<h1>Study plan</h1>");
    expect(html).not.toMatch(/<script|onerror=|javascript:/i);
  });
});