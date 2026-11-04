import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireVerifiedSession: vi.fn(),
  createAdminClient: vi.fn(),
  loadPurchasableEbook: vi.fn(),
  hasVerifiedEbookPurchase: vi.fn(),
  findPendingEbookOrder: vi.fn(),
  createPendingEbookOrder: vi.fn(),
  createOrder: vi.fn(),
  fetchOrder: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/auth-policy", () => ({ requireVerifiedSession: mocks.requireVerifiedSession }));
vi.mock("@/lib/api-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-utils")>();
  return { ...actual, assertTrustedOrigin: vi.fn() };
});
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/env.server", () => ({
  serverEnv: { RAZORPAY_KEY_ID: "rzp-test", RAZORPAY_KEY_SECRET: "test-secret" },
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/ebooks/config", () => ({
  getMarketplaceConfig: vi.fn().mockResolvedValue({ commissionPercent: 20 }),
}));
vi.mock("@/lib/ebooks/orders", () => ({
  loadPurchasableEbook: mocks.loadPurchasableEbook,
  hasVerifiedEbookPurchase: mocks.hasVerifiedEbookPurchase,
  findPendingEbookOrder: mocks.findPendingEbookOrder,
  createPendingEbookOrder: mocks.createPendingEbookOrder,
}));
vi.mock("@/lib/ebooks/razorpay-route", () => ({
  isRazorpayRouteConfigured: vi.fn(() => true),
}));
vi.mock("razorpay", () => ({
  default: class RazorpayMock {
    orders = { create: mocks.createOrder, fetch: mocks.fetchOrder };
  },
}));

import { POST } from "@/app/api/ebooks/checkout/route";

const ebook = {
  id: "00000000-0000-4000-8000-000000000001",
  user_id: "00000000-0000-4000-8000-000000000002",
  title: "Exam guide",
  slug: "exam-guide",
  price: 99,
  currency: "INR",
  status: "PUBLISHED",
  external_product_url: "https://example.com/book",
};
const pendingOrder = {
  id: "00000000-0000-4000-8000-000000000003",
  order_number: "XB-1",
  provider_order_id: "order-existing",
};

function request() {
  return new NextRequest("http://localhost/api/ebooks/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ebookId: ebook.id }),
  });
}

describe("POST /api/ebooks/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ user: { id: "buyer-1" }, profile: {} });
    mocks.loadPurchasableEbook.mockResolvedValue(ebook);
    mocks.hasVerifiedEbookPurchase.mockResolvedValue(false);
    mocks.findPendingEbookOrder.mockResolvedValue(null);
    mocks.createOrder.mockResolvedValue({ id: "order-new", amount: 9900, amount_paid: 0, currency: "INR" });
    mocks.fetchOrder.mockResolvedValue({ id: "order-existing", amount: 9900, amount_paid: 0, currency: "INR" });

    const payoutQuery = {
      select: vi.fn(() => payoutQuery),
      eq: vi.fn(() => payoutQuery),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { activation_status: "activated", settlement_verification_status: "verified" },
        error: null,
      }),
    };
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => table === "ebook_seller_payout_accounts"
        ? payoutQuery
        : { insert: vi.fn().mockResolvedValue({ error: null }) }),
    });
  });

  it("reuses the existing pending provider order", async () => {
    mocks.findPendingEbookOrder.mockResolvedValue(pendingOrder);

    const response = await POST(request());
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.fetchOrder).toHaveBeenCalledWith("order-existing");
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(result.data.providerOrder.id).toBe("order-existing");
  });

  it("returns the reservation winner's provider order when concurrent requests race", async () => {
    mocks.createPendingEbookOrder.mockResolvedValue({ outcome: "pending", order: pendingOrder });

    const response = await POST(request());
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.createOrder).toHaveBeenCalledOnce();
    expect(mocks.fetchOrder).toHaveBeenCalledWith("order-existing");
    expect(result.data.providerOrder.id).toBe("order-existing");
  });

  it("creates and returns the provider order when this request reserves checkout", async () => {
    mocks.createPendingEbookOrder.mockResolvedValue({
      outcome: "created",
      order: { id: "txn-new", order_number: "XB-NEW", provider_order_id: "order-new" },
    });

    const response = await POST(request());
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result.data).toMatchObject({ orderId: "txn-new", providerOrder: { id: "order-new" } });
  });
});
