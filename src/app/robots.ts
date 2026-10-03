import type { MetadataRoute } from "next";
import { APP_URL } from "@/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/dashboard",
        "/account/",
        "/settings",
        "/analytics",
        "/profile",
        "/notifications",
        "/study-planner",
        "/bookmarks",
        "/achievements",
        "/certificates",
        "/tests",
        "/test/result/",
        "/test/*/attempt",
        "/verify-email",
        "/dev-test",
        "/upload-demo",
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
      ],
    },
    sitemap: `${APP_URL.replace(/\/+$/, "")}/sitemap.xml`,
  };
}
