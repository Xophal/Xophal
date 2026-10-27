import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  unlockTestForUser: vi.fn(),
  verifyRazorpaySignature: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/test-access", () => ({ unlockTestForUser: mocks.unlockTestForUser }));
vi.mock("@/lib/razorpay", () => ({ verifyRazorpaySignature: mocks.verifyRazorpaySignature }));
vi.mock("@/lib/env.server", () => ({ serverEnv: { RAZORPAY_WEBHOOK_SECRET: "webhook-secret" } }));

import { POST } from "@/app/api/webhooks/razorpay/route";

function createQuery(data: unknown) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.update = vi.fn(() => query);
  query.maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  return query;
}

function request(body: unknown) {
  return new NextRequest("https://xophol.test/api/webhooks/razorpay", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": "valid-signature",
    },
    body: JSON.stringify(body),
  });
}

const capturedEntity = {
  id: "pay_123",
  order_id: "order_123",
  status: "captured",
  amount: 29900,
  currency: "INR",
};

describe("Razorpay webhook fulfillment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyRazorpaySignature.mockReturnValue(true);
    mocks.unlockTestForUser.mockResolvedValue({ unlocked: true });
  });

  it("delegates subscription payment and entitlement fulfillment to the atomic database RPC", async () => {
    const paymentQuery = createQuery({
      id: "payment-1",
      user_id: "user-1",
      plan_id: "plan-1",
      status: "pending",
      amount: 299,
      final_amount: 299,
      currency: "INR",
      razorpay_payment_id: null,
      metadata: {},
    });
    const rpc = vi.fn().mockResolvedValue({
      data: { already_fulfilled: false, subscription_id: "subscription-1" },
      error: null,
    });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => paymentQuery),
      rpc,
    });

    const response = await POST(request({
      event: "payment.captured",
      payload: { payment: { entity: capturedEntity } },
    }));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("fulfill_subscription_payment", {
      p_order_id: "order_123",
      p_payment_id: "pay_123",
    });
    expect(paymentQuery.update).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { status: "paid", duplicate: false },
    });
  });

  it("rejects captured amounts that do not match the stored order", async () => {
    const paymentQuery = createQuery({
      id: "payment-1",
      user_id: "user-1",
      plan_id: "plan-1",
      status: "pending",
      amount: 299,
      final_amount: 299,
      currency: "INR",
      razorpay_payment_id: null,
      metadata: {},
    });
    const rpc = vi.fn();
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => paymentQuery), rpc });

    const response = await POST(request({
      event: "payment.captured",
      payload: { payment: { entity: { ...capturedEntity, amount: 100 } } },
    }));

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("makes duplicate subscription webhook deliveries safe through the RPC", async () => {
    const paymentQuery = createQuery({
      id: "payment-1",
      user_id: "user-1",
      plan_id: "plan-1",
      status: "paid",
      amount: 299,
      final_amount: 299,
      currency: "INR",
      razorpay_payment_id: "pay_123",
      metadata: {},
    });
    const rpc = vi.fn().mockResolvedValue({ data: { already_fulfilled: true }, error: null });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => paymentQuery), rpc });

    const response = await POST(request({
      event: "payment.captured",
      payload: { payment: { entity: capturedEntity } },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { status: "paid", duplicate: true },
    });
  });

  it("grants a test purchase only after a signed capture and records it idempotently", async () => {
    const updateQuery = createQuery({ id: "payment-1" });
    const paymentQuery = createQuery({
      id: "payment-1",
      user_id: "user-1",
      plan_id: null,
      status: "pending",
      amount: 299,
      final_amount: 299,
      currency: "INR",
      razorpay_payment_id: null,
      metadata: { test_id: "11111111-1111-4111-8111-111111111111" },
    });
    paymentQuery.update.mockReturnValue(updateQuery);
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => paymentQuery) });

    const response = await POST(request({
      event: "payment.captured",
      payload: { payment: { entity: capturedEntity } },
    }));

    expect(response.status).toBe(200);
    expect(mocks.unlockTestForUser).toHaveBeenCalledWith(
      "user-1",
      "11111111-1111-4111-8111-111111111111"
    );
    expect(paymentQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      razorpay_payment_id: "pay_123",
      status: "completed",
    }));
    await expect(response.json()).resolves.toMatchObject({
      data: { status: "completed", received: true },
    });
  });

  it("does not downgrade an already paid subscription after a failure event", async () => {
    const paymentQuery = createQuery({
      id: "payment-1",
      user_id: "user-1",
      plan_id: "plan-1",
      status: "paid",
      amount: 299,
      final_amount: 299,
      currency: "INR",
      razorpay_payment_id: "pay_123",
      metadata: {},
    });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => paymentQuery) });

    const response = await POST(request({
      event: "payment.failed",
      payload: {
        payment: {
          entity: { id: "pay_123", order_id: "order_123", status: "failed" },
        },
      },
    }));

    expect(response.status).toBe(200);
    expect(paymentQuery.update).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      data: { status: "paid", duplicate: true },
    });
  });

  it("ignores unrelated signed events without looking up payment records", async () => {
    const from = vi.fn();
    mocks.createAdminClient.mockReturnValue({ from });

    const response = await POST(request({ event: "order.paid" }));

    expect(response.status).toBe(200);
    expect(from).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      data: { received: true, ignored: true },
    });
  });
});
