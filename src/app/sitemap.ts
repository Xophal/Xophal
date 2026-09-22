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

  try {
    const supabase = await createClient();
    const { data: boards } = await supabase.from("boards").select("slug").eq("is_active", true);
    const boardRoutes = (boards || []).map((b) => ({
      url: `${base}/learn?boardSlug=${encodeURIComponent(b.slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    }));
    return [...staticRoutes, ...boardRoutes];
  } catch {
    return staticRoutes;
  }
}
