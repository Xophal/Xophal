import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { getUserEntitlement } from "@/lib/entitlements";

describe("user entitlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("honors approved payment submissions as active paid access", async () => {
    const subscriptionQuery = {
      select: vi.fn(() => subscriptionQuery),
      eq: vi.fn(() => subscriptionQuery),
      gt: vi.fn(() => subscriptionQuery),
      order: vi.fn(() => subscriptionQuery),
      limit: vi.fn(() => subscriptionQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    const productQuery = {
      select: vi.fn(() => productQuery),
      eq: vi.fn(() => productQuery),
      order: vi.fn(() => productQuery),
      limit: vi.fn().mockResolvedValue({
        data: [{
          id: "submission-1",
          approved_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          product_catalog: {
            product_type: "class_9_monthly",
            duration_days: 30,
          },
        }],
        error: null,
      }),
    };

    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "subscriptions") return subscriptionQuery;
        if (table === "payment_submissions") return productQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const entitlement = await getUserEntitlement("user-123");

    expect(entitlement.isPaid).toBe(true);
    expect(entitlement.productType).toBe("class_9_monthly");
    expect(entitlement.activeSubscriptionId).toBe("submission-1");
  });
});
