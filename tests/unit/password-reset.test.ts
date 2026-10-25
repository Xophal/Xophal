import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createRouteHandlerClient: vi.fn(),
  createServerClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  ensureProfile: vi.fn(),
  promoteMainAdminProfile: vi.fn(),
  isAdminRole: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  limit: vi.fn(),
  cookieOptions: undefined as { getAll: () => unknown[]; setAll: (a: unknown[]) => void } | undefined,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: { getAll: () => unknown[]; setAll: (a: unknown[]) => void } }) => {
    mocks.cookieOptions = options.cookies;
    const sessionCookie = { name: "sb-access-token", value: "test-access-token", options: { path: "/", httpOnly: true } };
    options.cookies.setAll([sessionCookie]);
    return {
      auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null }),
          }),
        }),
      }),
    };
  },
}));

vi.mock("@/lib/supabase/route-handler", () => ({ createRouteHandlerClient: mocks.createRouteHandlerClient }));
vi.mock("@/lib/redis", () => ({ authRateLimit: { limit: mocks.limit } }));
vi.mock("@/lib/auth", () => ({ ensureProfile: mocks.ensureProfile, promoteMainAdminProfile: mocks.promoteMainAdminProfile }));
vi.mock("@/lib/roles", () => ({ isAdminRole: mocks.isAdminRole }));
vi.mock("@/lib/oauth-constants", () => ({ OAUTH_NEXT_COOKIE: "xophol_oauth_next" }));
vi.mock("next/headers", () => {
  const cookieStore = {
    getAll: () => [],
    get: () => undefined,
    set: vi.fn(),
  };
  return { cookies: vi.fn(async () => cookieStore) };
});

import { POST as requestForgot } from "@/app/api/auth/forgot/route";
import { GET as requestCallback } from "@/app/auth/callback/route";

type RequestInitWithoutNullSignal = Omit<RequestInit, "signal"> & { signal?: AbortSignal };

function normalizeRequestInit(init?: RequestInitWithoutNullSignal): RequestInitWithoutNullSignal | undefined {
  if (!init) return undefined;
  const { signal, ...rest } = init;
  return signal === null ? rest : init;
}

function request(path: string, body: unknown, init?: RequestInitWithoutNullSignal) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "127.0.0.1" },
    body: JSON.stringify(body),
    ...normalizeRequestInit(init),
  });
}

function callbackRequest(path: string, init?: RequestInitWithoutNullSignal) {
  return new NextRequest(`http://localhost${path}`, {
    method: "GET",
    ...normalizeRequestInit(init),
  });
}

describe("password reset flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.limit.mockResolvedValue({ success: true });
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    mocks.ensureProfile.mockResolvedValue(null);
    mocks.promoteMainAdminProfile.mockResolvedValue(null);
    mocks.isAdminRole.mockReturnValue(false);
    mocks.createRouteHandlerClient.mockResolvedValue({ auth: { resetPasswordForEmail: mocks.resetPasswordForEmail } });
  });

  it("sends the reset email without revealing account state", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
    mocks.createRouteHandlerClient.mockResolvedValue({ auth: { resetPasswordForEmail } });

    const response = await requestForgot(request("/api/auth/forgot", { email: " Student@Example.com " }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
    expect(resetPasswordForEmail).toHaveBeenCalledWith("student@example.com", {
      redirectTo: "http://localhost:3000/auth/callback?next=/reset-password",
    });

    const unregistered = await requestForgot(request("/api/auth/forgot", { email: "nobody@example.com" }));
    expect(unregistered.status).toBe(200);
  });

  it("rate-limits requests by IP+email", async () => {
    mocks.limit.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false });

    const first = await requestForgot(request("/api/auth/forgot", { email: "a@b.com" }));
    expect(first.status).toBe(200);

    const second = await requestForgot(request("/api/auth/forgot", { email: "a@b.com" }));
    expect(second.status).toBe(429);
    await expect(second.json()).resolves.toMatchObject({ success: false, code: "RATE_LIMIT" });
  });

  it("returns 503 when the rate limiter is unreachable", async () => {
    mocks.limit.mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));

    const response = await requestForgot(request("/api/auth/forgot", { email: "a@b.com" }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: "RATE_LIMIT_UNAVAILABLE" });
  });

  it("returns 400 for a malformed email", async () => {
    const response = await requestForgot(request("/api/auth/forgot", { email: "not-an-email" }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: "VALIDATION_ERROR" });
  });

  it("returns 503 when Supabase is unreachable", async () => {
    mocks.resetPasswordForEmail.mockRejectedValue(new Error("fetch failed"));

    const response = await requestForgot(request("/api/auth/forgot", { email: "a@b.com" }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: "RESET_EMAIL_UNAVAILABLE" });
  });

  it("exchanges the recovery code and hands off to /reset-password, skipping OAuth", async () => {
    const session = { access_token: "test-access-token", refresh_token: "test-refresh-token" };
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u-1", email: "student@example.com" }, session }, error: null });
    mocks.ensureProfile.mockResolvedValue({ id: "u-1", email: "student@example.com" });
    mocks.promoteMainAdminProfile.mockResolvedValue({ id: "u-1", email: "student@example.com" });

    const response = await requestCallback(
      callbackRequest("/auth/callback?type=recovery&code=recovery-code-123", { headers: { "x-real-ip": "127.0.0.1" } })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/reset-password");
    expect(mocks.ensureProfile).not.toHaveBeenCalled();
    expect(mocks.promoteMainAdminProfile).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toContain("sb-access-token=test-access-token");
  });

  it("returns verification_failed when the recovery code exchange fails", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { user: null }, error: new Error("code expired") });

    const response = await requestCallback(callbackRequest("/auth/callback?type=recovery&code=stale-code", {}));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login?error=verification_failed&message=Sign-in+could+not+be+completed.+Please+try+again.");
    expect(response.headers.get("set-cookie")).toContain("xophol_oauth_next=");
  });

  it("requires a code even when the type is recovery", async () => {
    const response = await requestCallback(callbackRequest("/auth/callback?type=recovery", {}));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login?error=verification_failed");
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("treats a bare recovery code as an OAuth flow (skips the recovery branch)", async () => {
    const session = { access_token: "test-access-token" };
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u-1", email: "admin@example.com" }, session }, error: null });
    mocks.ensureProfile.mockResolvedValue({ id: "u-1", email: "admin@example.com", role_id: "admin" });
    mocks.isAdminRole.mockReturnValue(true);
    mocks.promoteMainAdminProfile.mockResolvedValue({ id: "u-1", email: "admin@example.com" });

    const response = await requestCallback(callbackRequest("/auth/callback?code=oauth-code-123", {}));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/admin");
    expect(mocks.ensureProfile).toHaveBeenCalled();
  });
});
