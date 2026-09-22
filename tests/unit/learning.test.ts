import { describe, expect, it } from "vitest";
import { buildLearnPath } from "@/lib/learning";

describe("buildLearnPath", () => {
  it("builds a query-string based learning path for the active board, class, subject, and chapter", () => {
    expect(
      buildLearnPath({
        boardSlug: "cbse",
        classSlug: "class-10",
        subjectSlug: "science",
        chapterSlug: "light-reflection",
      })
    ).toBe("/learn?boardSlug=cbse&classSlug=class-10&subjectSlug=science&chapterSlug=light-reflection");
  });
});
