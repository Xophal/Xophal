import type { MetadataRoute } from "next";
import { APP_URL } from "@/constants";
import { getSubjectPagePath } from "@/lib/ebooks/seo";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 1000;

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = APP_URL.replace(/\/+$/, "");
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/courses`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/mock-tests`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/previous-year-papers`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/notes`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/ebooks`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/leaderboard`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/faq`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/help-center`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/privacy-policy`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/terms-and-conditions`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/refund-policy`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/cookie-policy`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/careers`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/press`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const supabase = await createClient();
  const [boards, books, categories, contributors, subjects, blogs, tests, exams] = await Promise.all([
    fetchAllPages((from, to) => supabase.from("boards").select("slug").eq("is_active", true).order("slug").range(from, to)),
    fetchAllPages((from, to) => supabase.from("ebook_listings").select("slug, updated_at, exam, exam_id").eq("status", "PUBLISHED").order("published_at", { ascending: false }).order("slug").range(from, to)),
    fetchAllPages((from, to) => supabase.from("ebook_categories").select("slug, ebook_listings!inner(count)").eq("is_active", true).eq("ebook_listings.status", "PUBLISHED").order("slug").range(from, to)),
    fetchAllPages((from, to) => supabase.from("ebook_contributors").select("slug, ebook_listings!inner(count)").eq("ebook_listings.status", "PUBLISHED").order("slug").range(from, to)),
    fetchAllPages((from, to) => supabase.from("subjects").select("slug, classes!inner(slug, is_active, boards!inner(slug, is_active)), ebook_listings!inner(count)").eq("is_active", true).eq("classes.is_active", true).eq("classes.boards.is_active", true).eq("ebook_listings.status", "PUBLISHED").order("slug").range(from, to)),
    fetchAllPages((from, to) => supabase.from("blogs").select("slug, updated_at").eq("is_published", true).order("published_at", { ascending: false }).order("slug").range(from, to)),
    fetchAllPages((from, to) => supabase.from("mock_tests").select("slug, updated_at").eq("is_published", true).eq("is_active", true).gt("total_questions", 0).gt("duration_minutes", 0).order("slug").range(from, to)),
    fetchAllPages((from, to) => supabase.from("exams").select("id, name, slug").eq("is_active", true).order("slug").range(from, to)),
  ]);

    const boardRoutes: MetadataRoute.Sitemap = boards.map((board) => ({
      url: `${base}/learn?boardSlug=${encodeURIComponent(board.slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    }));
    const bookRoutes: MetadataRoute.Sitemap = books.map((book) => ({
      url: `${base}/ebooks/${book.slug}`,
      lastModified: book.updated_at ? new Date(book.updated_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
    const categoryRoutes: MetadataRoute.Sitemap = categories
      .filter((category) => category.ebook_listings.some((listing) => listing.count > 0))
      .map((category) => ({
      url: `${base}/ebooks/category/${category.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
    const authorRoutes: MetadataRoute.Sitemap = contributors.map((contributor) => ({
      url: `${base}/authors/${contributor.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));
    const subjectRoutes: MetadataRoute.Sitemap = subjects
      .filter((subject) => subject.ebook_listings.some((listing) => listing.count > 0))
      .flatMap((subject) => {
        const classInfo = relation(subject.classes);
        const board = relation(classInfo?.boards);
        return classInfo && board
          ? [{
              url: `${base}${getSubjectPagePath(board.slug, classInfo.slug, subject.slug)}`,
              changeFrequency: "weekly" as const,
              priority: 0.6,
            }]
          : [];
      });
    const blogRoutes: MetadataRoute.Sitemap = blogs.map((post) => ({
      url: `${base}/blog/${post.slug}`,
      lastModified: post.updated_at ? new Date(post.updated_at) : undefined,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
    const testRoutes: MetadataRoute.Sitemap = tests.map((test) => ({
      url: `${base}/test/${test.slug}`,
      lastModified: test.updated_at ? new Date(test.updated_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
    const linkedExamIds = new Set(books.map((book) => book.exam_id).filter((id): id is string => Boolean(id)));
    const publishedExamNames = new Set(books.map((book) => book.exam).filter((name): name is string => Boolean(name)));
    // Exam pages are public only when a published listing links by id or legacy exam name.
    const examRoutes: MetadataRoute.Sitemap = exams
      .filter((exam) => linkedExamIds.has(exam.id) || publishedExamNames.has(exam.name))
      .map((exam) => ({
      url: `${base}/ebooks/exam/${exam.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    return [...staticRoutes, ...boardRoutes, ...bookRoutes, ...categoryRoutes, ...authorRoutes, ...subjectRoutes, ...blogRoutes, ...testRoutes, ...examRoutes];
}
