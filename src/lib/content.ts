export type ContentType = "blog" | "lesson" | "note" | "faq" | "announcement" | "question" | "mock-test";
export type ContentStatus = "draft" | "review" | "approved" | "published" | "archived";

export type ContentSubmissionInput = {
  type: string;
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  status?: string;
  category?: string;
  tags?: string[];
  author?: string;
  metaTitle?: string;
  metaDescription?: string;
  [key: string]: unknown;
};

const normalizedTypeMap: Record<string, ContentType> = {
  blog: "blog",
  blogs: "blog",
  lesson: "lesson",
  lessons: "lesson",
  note: "note",
  notes: "note",
  faq: "faq",
  faqs: "faq",
  announcement: "announcement",
  announcements: "announcement",
  question: "question",
  questions: "question",
  "mock-test": "mock-test",
  "mock_test": "mock-test",
  mocktests: "mock-test",
  "mock-tests": "mock-test",
};

const normalizedStatusMap: Record<string, ContentStatus> = {
  draft: "draft",
  review: "review",
  approved: "approved",
  published: "published",
  archived: "archived",
};

export function validateContentSubmission(input: ContentSubmissionInput) {
  const type = normalizedTypeMap[String(input.type ?? "").trim().toLowerCase()] ?? "blog";
  const status = normalizedStatusMap[String(input.status ?? "draft").trim().toLowerCase()] ?? "draft";

  const title = String(input.title ?? "").trim();
  const content = String(input.content ?? "").trim();
  const slug = String(input.slug ?? "").trim() || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "untitled-content";

  if (!title) {
    throw new Error("Content title is required.");
  }

  if (!content) {
    throw new Error("Content body is required.");
  }

  return {
    ...input,
    type,
    status,
    title,
    slug,
    excerpt: String(input.excerpt ?? "").trim(),
    content,
    category: String(input.category ?? "").trim(),
    tags: Array.isArray(input.tags) ? input.tags.map(String).filter(Boolean) : [],
    author: String(input.author ?? "").trim(),
    metaTitle: String(input.metaTitle ?? "").trim() || title,
    metaDescription: String(input.metaDescription ?? "").trim(),
  };
}
