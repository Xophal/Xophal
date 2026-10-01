import type { MetadataRoute } from "next";
import { APP_URL } from "@/constants";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = APP_URL;
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/courses`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/mock-tests`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/previous-year-papers`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/notes`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/ebooks`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/login`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/register`, changeFrequency: "monthly", priority: 0.7 },
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

  /**
   * Marketplace rows are added on a best-effort basis: the sitemap must still be
   * served when the database or the anon role is unavailable.
   */
  try {
    const supabase = await createClient();
    const [boardsResult, booksResult, categoriesResult, contributorsResult] = await Promise.all([
      supabase.from("boards").select("slug").eq("is_active", true),
      supabase
        .from("ebook_listings")
        .select("slug, updated_at")
        .eq("status", "PUBLISHED")
        .order("published_at", { ascending: false })
        .limit(2000),
      supabase.from("ebook_categories").select("slug").eq("is_active", true),
      supabase.from("ebook_contributors").select("slug").limit(1000),
    ]);

    const boardRoutes: MetadataRoute.Sitemap = (boardsResult.data ?? []).map((board) => ({
      url: `${base}/learn?boardSlug=${encodeURIComponent(board.slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    }));
    const bookRoutes: MetadataRoute.Sitemap = (booksResult.data ?? []).map((book) => ({
      url: `${base}/ebooks/${book.slug}`,
      lastModified: book.updated_at ? new Date(book.updated_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
    const categoryRoutes: MetadataRoute.Sitemap = (categoriesResult.data ?? []).map((category) => ({
      url: `${base}/ebooks/category/${category.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
    const authorRoutes: MetadataRoute.Sitemap = (contributorsResult.data ?? []).map((contributor) => ({
      url: `${base}/authors/${contributor.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));

    return [...staticRoutes, ...boardRoutes, ...bookRoutes, ...categoryRoutes, ...authorRoutes];
  } catch {
    return staticRoutes;
  }
}
