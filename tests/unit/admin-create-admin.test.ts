import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminAuth: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdminAuth: mocks.requireAdminAuth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { POST } from "@/app/api/admin/create-admin/route";

function request(headers: Record<string, string>) {
  return new NextRequest("https://app.xophol.com/api/admin/create-admin", {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: "new-admin@example.com",
      password: "secure-password",
      fullName: "New Admin",
    }),
  });
}

describe("POST /api/admin/create-admin", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.xophol.com");
    vi.stubEnv("TRUSTED_ORIGINS", "");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects cross-origin account creation before authenticating or provisioning", async () => {
    const response = await POST(request({
      origin: "https://evil.example",
      host: "app.xophol.com",
      "content-type": "application/json",
    }));

    expect(response.status).toBe(403);
    expect(mocks.requireAdminAuth).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects non-JSON bodies before authenticating or provisioning", async () => {
    const response = await POST(request({
      origin: "https://app.xophol.com",
      host: "app.xophol.com",
      "content-type": "text/plain",
    }));

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "UNSUPPORTED_MEDIA_TYPE",
    });
    expect(mocks.requireAdminAuth).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
