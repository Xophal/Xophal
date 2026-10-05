import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireVerifiedSession: vi.fn(),
  createAdminClient: vi.fn(),
  unlockTestForUser: vi.fn(),
  fetchOrder: vi.fn(),
  fetchPayment: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/auth-policy", () => ({ requireVerifiedSession: mocks.requireVerifiedSession }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/test-access", () => ({ unlockTestForUser: mocks.unlockTestForUser }));
vi.mock("@/lib/env.server", () => ({
  serverEnv: { RAZORPAY_KEY_ID: "test-key", RAZORPAY_KEY_SECRET: "test-secret" },
}));
vi.mock("razorpay", () => ({
  default: class RazorpayMock {
    orders = { fetch: mocks.fetchOrder };
    payments = { fetch: mocks.fetchPayment };
  },
}));

import { POST as verifyPayment } from "@/app/api/verify-payment/route";

const orderId = "order_123";
const paymentId = "pay_123";
const testId = "00000000-0000-4000-8000-000000000001";
const signature = createHmac("sha256", "test-secret")
  .update(`${orderId}|${paymentId}`)
  .digest("hex");

function createAdminClient() {
  const paymentQuery = {
    select: vi.fn(() => paymentQuery),
    eq: vi.fn(() => paymentQuery),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: "payment-row",
        user_id: "user-123",
        amount: 12,
        currency: "INR",
        status: "pending",
        metadata: { test_id: testId },
      },
      error: null,
    }),
  };
  const updateQuery = { eq: vi.fn(() => updateQuery) };
  const payments = {
    ...paymentQuery,
    update: vi.fn(() => updateQuery),
  };
  return { from: vi.fn(() => payments), payments, updateQuery };
}

function createRequest() {
  return new NextRequest("http://localhost/api/verify-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      testId,
    }),
  });
}

describe("POST /api/verify-payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({
      user: { id: "user-123" },
      profile: { id: "user-123" },
    });
    mocks.fetchOrder.mockResolvedValue({ amount: 1200, currency: "INR" });
    mocks.unlockTestForUser.mockResolvedValue({ unlocked: true });
  });

  it("does not unlock a test for an authorized but uncaptured payment", async () => {
    const admin = createAdminClient();
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.fetchPayment.mockResolvedValue({
      id: paymentId,
      order_id: orderId,
      status: "authorized",
      amount: 1200,
      currency: "INR",
    });

    const response = await verifyPayment(createRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "PAYMENT_NOT_CAPTURED",
    });
    expect(mocks.unlockTestForUser).not.toHaveBeenCalled();
    expect(admin.payments.update).not.toHaveBeenCalled();
  });

  it("unlocks the test only when Razorpay confirms the matching payment was captured", async () => {
    const admin = createAdminClient();
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.fetchPayment.mockResolvedValue({
      id: paymentId,
      order_id: orderId,
      status: "captured",
      amount: 1200,
      currency: "INR",
    });

    const response = await verifyPayment(createRequest());

    expect(response.status).toBe(200);
    expect(mocks.unlockTestForUser).toHaveBeenCalledWith("user-123", testId);
    expect(admin.payments.update).toHaveBeenCalledWith(expect.objectContaining({
      razorpay_payment_id: paymentId,
      status: "completed",
    }));
  });
});
