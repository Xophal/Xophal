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

  it("does not grant access from an approved payment submission without a subscription", async () => {
    const subscriptionQuery = {
      select: vi.fn(() => subscriptionQuery),
      eq: vi.fn(() => subscriptionQuery),
      lte: vi.fn(() => subscriptionQuery),
      gt: vi.fn(() => subscriptionQuery),
      order: vi.fn(() => subscriptionQuery),
      limit: vi.fn(() => subscriptionQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    const from = vi.fn(() => subscriptionQuery);
    mocks.createAdminClient.mockReturnValue({ from });

    const entitlement = await getUserEntitlement("user-123");

    expect(entitlement).toMatchObject({
      isFree: true,
      isPaid: false,
      activeSubscriptionId: null,
      productType: null,
    });
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("subscriptions");
  });
});
