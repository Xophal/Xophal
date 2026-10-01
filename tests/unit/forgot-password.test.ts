import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createRouteHandlerClient: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("@/lib/supabase/route-handler", () => ({
  createRouteHandlerClient: mocks.createRouteHandlerClient,
}));
vi.mock("@/lib/redis", () => ({ authRateLimit: { limit: mocks.limit } }));

import { POST } from "@/app/api/auth/forgot/route";

describe("forgot password route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.limit.mockResolvedValue({ success: true });
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    mocks.createRouteHandlerClient.mockResolvedValue({
      auth: { resetPasswordForEmail: mocks.resetPasswordForEmail },
    });
  });

  it("uses the bare, allowlisted reset-password URL", async () => {
    const request = new NextRequest("http://localhost:3000/api/auth/forgot", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        "x-real-ip": "127.0.0.1",
      },
      body: JSON.stringify({ email: "Student@Example.com" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("student@example.com", {
      redirectTo: "http://localhost:3000/reset-password",
    });
  });
});