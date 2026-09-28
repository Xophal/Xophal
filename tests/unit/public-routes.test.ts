import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { updateSession } from "@/lib/supabase/middleware";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

function buildRequest(path: string) {
  return new NextRequest(`https://example.com${path}`);
}

describe("public route allowlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: null },
          error: null,
        }),
      },
      from: vi.fn(),
    } as never);
  });

  it("allows sitemap.xml and robots.txt to bypass auth", async () => {
    const robotsResponse = await updateSession(buildRequest("/robots.txt"));
    expect(robotsResponse.status).toBe(200);

    const sitemapResponse = await updateSession(buildRequest("/sitemap.xml"));
    expect(sitemapResponse.status).toBe(200);
  });

  it("still redirects protected routes for unauthenticated users", async () => {
    const response = await updateSession(buildRequest("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });
});
