import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit }));

import { GET as listMockTests } from "@/app/api/mock-tests/route";

describe("GET /api/mock-tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue(undefined);
  });

  it("includes published premium tests in the public listing", async () => {
    const premiumTest = {
      id: "premium-test",
      title: "Premium mock test",
      slug: "premium-mock-test",
      is_premium: true,
    };
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      gt: vi.fn(() => query),
      order: vi.fn(() => query),
      range: vi.fn().mockResolvedValue({ data: [premiumTest], error: null, count: 1 }),
    };
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(() => query),
    });

    const response = await listMockTests(new NextRequest("http://localhost/api/mock-tests"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { data: [premiumTest], pagination: { total: 1 } },
    });
    expect(query.eq).not.toHaveBeenCalledWith("is_premium", false);
  });
});
