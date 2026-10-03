import { describe, expect, it } from "vitest";
import {
  getAppUrl,
  getEbookMetadata,
  getImageSource,
  getPublicSocialImage,
  getSubjectPagePath,
} from "@/lib/ebooks/seo";

describe("public eBook SEO metadata", () => {
  it("builds a contextual title, unique description, canonical, and social metadata", () => {
    const metadata = getEbookMetadata({
      title: "Assam Police General Knowledge Guide",
      slug: "assam-police-general-knowledge-guide",
      authorName: "A Teacher",
      description: "A concise resource for exam preparation.",
      exam: "Assam Police Exam",
      subject: "General Knowledge",
      language: "English",
    });

    expect(metadata.title).toBe("Assam Police General Knowledge Guide | Assam Police Exam");
    expect(metadata.description).toContain("A Teacher");
    expect(metadata.description).toContain("A concise resource for exam preparation.");
    expect(metadata.description?.length).toBeLessThanOrEqual(155);
    expect(metadata.alternates?.canonical).toBe(getAppUrl("/ebooks/assam-police-general-knowledge-guide"));
    expect(metadata.openGraph).toMatchObject({
      type: "book",
      url: getAppUrl("/ebooks/assam-police-general-knowledge-guide"),
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("does not append a duplicate Xophol suffix to the generated page title", () => {
    const metadata = getEbookMetadata({
      title: "Mathematics Workbook | Xophol",
      slug: "mathematics-workbook",
      authorName: "A Teacher",
      subject: "Mathematics",
    });

    expect(metadata.title).toBe("Mathematics Workbook");
  });

  it("uses the branded fallback for missing or unsafe cover URLs", () => {
    expect(getPublicSocialImage()).toBe(getAppUrl("/opengraph-image"));
    expect(getPublicSocialImage("javascript:alert(1)")).toBe(getAppUrl("/opengraph-image"));
    expect(getImageSource(null)).toBe("/opengraph-image");
    expect(getImageSource("javascript:alert(1)")).toBe("/opengraph-image");
  });

  it("keeps safe same-origin image paths local for optimized page rendering", () => {
    expect(getImageSource(getAppUrl("/team/cover.webp"))).toBe("/team/cover.webp");
  });

  it("uses a board/class/subject path so repeated subject slugs cannot collide", () => {
    expect(getSubjectPagePath("assam-board", "class-10", "general-mathematics"))
      .toBe("/ebooks/subject/assam-board/class-10/general-mathematics");
  });
});
