import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createRouteHandlerClient: vi.fn(),
  createAdminClient: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("@/lib/supabase/route-handler", () => ({ createRouteHandlerClient: mocks.createRouteHandlerClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/redis", () => ({ authRateLimit: { limit: mocks.limit } }));

import { POST as requestOtp } from "@/app/api/auth/otp/request/route";
import { POST as verifyOtp } from "@/app/api/auth/otp/verify/route";
import { otpRequestSchema, otpVerifySchema } from "@/lib/validations";

function request(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "127.0.0.1" },
    body: JSON.stringify(body),
  });
}

describe("OTP authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.limit.mockResolvedValue({ success: true });
  });

  it("requires a name for signup requests", () => {
    expect(otpRequestSchema.safeParse({ email: "student@example.com", intent: "signup" }).success).toBe(false);
  });

  it("accepts only six-digit verification codes", () => {
    expect(otpVerifySchema.safeParse({ email: "student@example.com", intent: "login", token: "12345" }).success).toBe(false);
    expect(otpVerifySchema.safeParse({ email: "student@example.com", intent: "login", token: "123456" }).success).toBe(true);
  });

  it("sends a signup OTP without exposing account state", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    mocks.createRouteHandlerClient.mockResolvedValue({ auth: { signInWithOtp } });

    const response = await requestOtp(request("/api/auth/otp/request", {
      email: " Student@Example.com ",
      intent: "signup",
      fullName: "Student Example",
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
    expect(signInWithOtp).toHaveBeenCalledWith(expect.objectContaining({
      email: "student@example.com",
      options: expect.objectContaining({
        shouldCreateUser: true,
      }),
    }));
    // The OTP flow must not embed a Magic Link / localhost callback URL.
    expect(signInWithOtp.mock.calls[0][0].options.emailRedirectTo).toBeUndefined();
  });

  it("returns a temporary service error when the auth provider is unreachable", async () => {
    mocks.createRouteHandlerClient.mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));

    const response = await requestOtp(request("/api/auth/otp/request", {
      email: "student@example.com",
      intent: "login",
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "OTP_PROVIDER_UNAVAILABLE",
    });
  });

  it("rejects malformed verification requests before contacting Supabase", async () => {
    const response = await verifyOtp(request("/api/auth/otp/verify", {
      email: "student@example.com",
      intent: "login",
      token: "not-a-code",
    }));

    expect(response.status).toBe(400);
    expect(mocks.createRouteHandlerClient).not.toHaveBeenCalled();
  });
});