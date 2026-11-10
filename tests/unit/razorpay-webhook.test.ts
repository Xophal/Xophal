import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  requireAdminRole: vi.fn(),
  refund: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/auth", () => ({ requireAdminRole: mocks.requireAdminRole }));
vi.mock("@/lib/env.server", () => ({
  serverEnv: {
    RAZORPAY_WEBHOOK_SECRET: "test-webhook-secret",
    RAZORPAY_KEY_ID: "test-key",
    RAZORPAY_KEY_SECRET: "test-secret",
  },
}));
vi.mock("razorpay", () => ({
  default: class RazorpayMock {
    payments = { refund: mocks.refund };
  },
}));

import { POST as receiveWebhook } from "@/app/api/webhooks/razorpay/route";
import { PATCH as refundPayment } from "@/app/api/admin/payments/[id]/route";

const paymentId = "00000000-0000-4000-8000-000000000001";

function signedRequest(body: unknown) {
  const rawBody = JSON.stringify(body);
  const signature = createHmac("sha256", "test-webhook-secret").update(rawBody).digest("hex");
  return new NextRequest("http://localhost/api/webhooks/razorpay", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-razorpay-signature": signature },
    body: rawBody,
  });
}

describe("Razorpay subscription and refund webhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the atomic database finalizer for captured payment fulfillment", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "paid", subscription_id: "subscription-1" }, error: null });
    mocks.createAdminClient.mockReturnValue({ rpc: mocks.rpc });

    const response = await receiveWebhook(signedRequest({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_123", order_id: "order_123", status: "captured", amount: 29900, currency: "INR" } } },
    }));

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("finalize_razorpay_payment", {
      p_order_id: "order_123",
      p_payment_id: "pay_123",
      p_amount_minor: 29900,
      p_currency: "INR",
      p_event: "payment.captured",
    });
  });

  it("rejects an event whose payment status disagrees with the event", async () => {
    mocks.createAdminClient.mockReturnValue({ rpc: mocks.rpc });

    const response = await receiveWebhook(signedRequest({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_123", order_id: "order_123", status: "authorized", amount: 29900, currency: "INR" } } },
    }));

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("keeps an eBook or subscription payment pending until Razorpay confirms the refund", async () => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: paymentId, final_amount: 299, amount: 299 },
        error: null,
      }),
    };
    mocks.from.mockReturnValue(query);
    mocks.rpc.mockResolvedValue({ data: { status: "refund_pending" }, error: null });
    mocks.createAdminClient.mockReturnValue({ from: mocks.from, rpc: mocks.rpc });

    const response = await receiveWebhook(signedRequest({
      event: "refund.created",
      payload: { refund: { entity: { id: "rfnd_123", payment_id: "pay_123", amount: 29900 } } },
    }));

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("attach_razorpay_payment_refund", {
      p_payment_id: paymentId,
      p_refund_id: "rfnd_123",
    });
    expect(mocks.rpc).not.toHaveBeenCalledWith("complete_razorpay_payment_refund", expect.anything());
  });

  it("issues only a provider refund and revokes access after a confirmed full refund", async () => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: paymentId,
          status: "paid",
          amount: 299,
          final_amount: 299,
          currency: "INR",
          razorpay_payment_id: "pay_123",
          razorpay_refund_id: null,
        },
        error: null,
      }),
    };
    mocks.from.mockReturnValue(query);
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "begin_razorpay_payment_refund") return { data: { status: "started" }, error: null };
      if (name === "complete_razorpay_payment_refund") return { data: { status: "refunded", refund_id: "rfnd_123" }, error: null };
      return { data: null, error: null };
    });
    mocks.createAdminClient.mockReturnValue({ from: mocks.from, rpc: mocks.rpc });
    mocks.requireAdminRole.mockResolvedValue({ user: { id: "refund-admin" } });
    mocks.refund.mockResolvedValue({ id: "rfnd_123", status: "processed", amount: 29900 });

    const response = await refundPayment(new NextRequest(`http://localhost/api/admin/payments/${paymentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "refunded" }),
    }), { params: Promise.resolve({ id: paymentId }) });

    expect(response.status).toBe(200);
    expect(mocks.refund).toHaveBeenCalledWith("pay_123", expect.any(Object));
    expect(mocks.rpc).toHaveBeenCalledWith("complete_razorpay_payment_refund", {
      p_payment_id: paymentId,
      p_refund_id: "rfnd_123",
      p_amount_minor: 29900,
      p_actor_id: "refund-admin",
    });
  });
});
