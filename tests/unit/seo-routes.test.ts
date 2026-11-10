import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

describe("public SEO routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockRejectedValue(new Error("Database unavailable"));
  });

  it("keeps authenticated student routes out of crawler access", () => {
    const rules = robots().rules;
    const disallowed = Array.isArray(rules)
      ? rules.flatMap((rule) => rule.disallow ?? [])
      : rules.disallow ?? [];

    expect(disallowed).toEqual(expect.arrayContaining([
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
    ]));
    expect(disallowed).not.toContain("/mock-tests");
  });

  it("does not list authenticated student pages in the sitemap", async () => {
    const entries = await sitemap();
    const paths = entries.map(({ url }) => new URL(url).pathname);

    expect(paths).not.toContain("/leaderboard");
    expect(paths).not.toContain("/learn");
    expect(mocks.createClient).toHaveBeenCalledOnce();
  });
});
