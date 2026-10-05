import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createRouteHandlerClient: vi.fn(),
  ensureProfile: vi.fn(),
  promoteMainAdminProfile: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("@/lib/supabase/route-handler", () => ({
  createRouteHandlerClient: mocks.createRouteHandlerClient,
}));
vi.mock("@/lib/auth", () => ({
  ensureProfile: mocks.ensureProfile,
  promoteMainAdminProfile: mocks.promoteMainAdminProfile,
}));
vi.mock("@/lib/redis", () => ({ authRateLimit: { limit: mocks.limit } }));

import { POST } from "@/app/api/auth/login/route";

function request() {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "127.0.0.1" },
    body: JSON.stringify({ email: "student@example.com", password: "correct-horse" }),
  });
}

describe("password login account checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.limit.mockResolvedValue({ success: true });
  });

  it("clears the newly-created session for a deactivated account", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    mocks.createRouteHandlerClient.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            user: { id: "user-1", email: "student@example.com", email_confirmed_at: "2025-01-01" },
            session: {},
          },
          error: null,
        }),
        signOut,
      },
    });
    mocks.ensureProfile.mockResolvedValue({ id: "user-1", is_active: false, email_verified: true });

    const response = await POST(request());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "UNAUTHORIZED",
      error: "Invalid email or password, or account unavailable. If you have not verified your email, use the email-code option.",
    });
    expect(signOut).toHaveBeenCalledOnce();
    expect(mocks.promoteMainAdminProfile).not.toHaveBeenCalled();
  });

  it("clears the session and rejects an unverified account", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    mocks.createRouteHandlerClient.mockResolvedValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: { id: "user-2", email: "student@example.com" }, session: {} },
          error: null,
        }),
        signOut,
      },
    });
    mocks.ensureProfile.mockResolvedValue({ id: "user-2", is_active: true, email_verified: false });

    const response = await POST(request());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "UNAUTHORIZED",
      error: "Invalid email or password, or account unavailable. If you have not verified your email, use the email-code option.",
    });
    expect(signOut).toHaveBeenCalledOnce();
  });
});
