import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit }));

import { GET as listMockTests } from "@/app/api/mock-tests/route";

describe("GET /api/mock-tests", () => {
  it("lists published premium tests without granting test-content access", async () => {
    const tests = [
      { id: "premium-test", slug: "premium-test", access_category: "premium", is_premium: true },
      {
        id: "subscription-test",
        slug: "subscription-test",
        access_category: "subscription_exclusive",
        is_premium: false,
      },
    ];
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      gt: vi.fn(() => query),
      or: vi.fn(() => query),
      order: vi.fn(() => query),
      range: vi.fn().mockResolvedValue({ data: tests, error: null, count: tests.length }),
    };
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => query) });
    mocks.checkRateLimit.mockResolvedValue(undefined);

    const response = await listMockTests(new NextRequest("http://localhost/api/mock-tests"));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.data.data).toEqual(tests);
    expect(query.eq).toHaveBeenCalledWith("is_published", true);
    expect(query.eq).toHaveBeenCalledWith("is_active", true);
    expect(query.or).not.toHaveBeenCalled();
  });
});
