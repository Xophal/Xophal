import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  recordEbookRefund: vi.fn(),
  findOrderByProviderOrderId: vi.fn(),
  markEbookOrderFulfilled: vi.fn(),
  markEbookOrderPaid: vi.fn(),
  recordVerifiedEbookPaymentCosts: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/env.server", () => ({
  serverEnv: { RAZORPAY_WEBHOOK_SECRET: "webhook-secret" },
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/ebooks/orders", () => ({
  findOrderByProviderOrderId: mocks.findOrderByProviderOrderId,
  markEbookOrderFulfilled: mocks.markEbookOrderFulfilled,
  markEbookOrderPaid: mocks.markEbookOrderPaid,
  recordEbookRefund: mocks.recordEbookRefund,
  recordVerifiedEbookPaymentCosts: mocks.recordVerifiedEbookPaymentCosts,
}));

import { POST } from "@/app/api/ebooks/webhook/razorpay/route";

function request(body: unknown) {
  const rawBody = JSON.stringify(body);
  const signature = createHmac("sha256", "webhook-secret").update(rawBody).digest("hex");
  return new NextRequest("http://localhost/api/ebooks/webhook/razorpay", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-razorpay-signature": signature },
    body: rawBody,
  });
}

describe("POST /api/ebooks/webhook/razorpay refunds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const refundQuery = {
      select: vi.fn(() => refundQuery),
      eq: vi.fn(() => refundQuery),
      maybeSingle: mocks.maybeSingle,
    };
    mocks.maybeSingle.mockResolvedValue({ data: { id: "transaction-1" }, error: null });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => refundQuery) });
  });

  it("waits for refund.processed rather than revoking access on refund.created", async () => {
    const response = await POST(request({
      event: "refund.created",
      payload: { refund: { entity: { id: "rfnd-1", payment_id: "pay-1", amount: 9900 } } },
    }));

    expect(response.status).toBe(200);
    expect(mocks.recordEbookRefund).not.toHaveBeenCalled();
  });

  it("records the provider refund ID and amount for processed refunds", async () => {
    const response = await POST(request({
      event: "refund.processed",
      payload: { refund: { entity: { id: "rfnd-partial", payment_id: "pay-1", amount: 2500 } } },
    }));

    expect(response.status).toBe(200);
    expect(mocks.recordEbookRefund).toHaveBeenCalledWith({
      orderId: "transaction-1",
      providerRefundId: "rfnd-partial",
      amountMinor: 2500,
    });
  });

  it("rejects malformed processed refund events", async () => {
    const response = await POST(request({
      event: "refund.processed",
      payload: { refund: { entity: { id: "rfnd-invalid", payment_id: "pay-1", amount: 0 } } },
    }));

    expect(response.status).toBe(400);
    expect(mocks.recordEbookRefund).not.toHaveBeenCalled();
  });
});
