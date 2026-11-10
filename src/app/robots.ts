import type { MetadataRoute } from "next";
import { APP_URL } from "@/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/dashboard",
        "/settings",
        "/profile",
        "/analytics",
        "/bookmarks",
        "/achievements",
        "/certificates",
        "/leaderboard",
        "/notifications",
        "/study-planner",
        "/subscriptions",
        "/tests",
        "/learn",
        "/engine-tests",
        "/test",
      ],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
