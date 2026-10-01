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

  it("keeps eBook and contributor discovery public", async () => {
    const marketplace = await updateSession(buildRequest("/ebooks/assamese-books"));
    const author = await updateSession(buildRequest("/authors/teacher-1"));

    expect(marketplace.status).toBe(200);
    expect(marketplace.headers.get("location")).toBeNull();
    expect(author.status).toBe(200);
    expect(author.headers.get("location")).toBeNull();
  });

  it("still redirects protected routes for unauthenticated users", async () => {
    const response = await updateSession(buildRequest("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("keeps authenticated visitors on the public homepage", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { role_id: "student", roles: [{ code: "student" }] },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });

    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null }),
      },
      from: vi.fn().mockReturnValue({ select }),
    } as never);

    const response = await updateSession(buildRequest("/"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("sends unverified sessions to verification instead of looping through the dashboard", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { email: "student@example.com", email_verified: false, role_id: "student", roles: [{ code: "student" }] },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null }),
      },
      from: vi.fn().mockReturnValue({ select }),
    } as never);

    const response = await updateSession(buildRequest("/login?redirect=%2Fdashboard"));
    const location = new URL(response.headers.get("location")!);

    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/verify-email");
    expect(location.searchParams.get("email")).toBe("student@example.com");
  });
});
