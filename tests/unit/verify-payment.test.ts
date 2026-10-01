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
  updatePayment: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/auth-policy", () => ({ requireVerifiedSession: mocks.requireVerifiedSession }));
vi.mock("@/lib/env.server", () => ({ serverEnv: { RAZORPAY_KEY_ID: "rzp_test_key", RAZORPAY_KEY_SECRET: "test-secret" } }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/test-access", () => ({ unlockTestForUser: mocks.unlockTestForUser }));
vi.mock("razorpay", () => ({
  default: class {
    orders = { fetch: mocks.fetchOrder };
    payments = { fetch: mocks.fetchPayment };
  },
}));

import { POST } from "@/app/api/verify-payment/route";

const orderId = "order-1";
const paymentId = "payment-1";
const testId = "00000000-0000-4000-8000-000000000001";
const signature = createHmac("sha256", "test-secret").update(`${orderId}|${paymentId}`).digest("hex");

function request() {
  return new NextRequest("http://localhost:3000/api/verify-payment", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      testId,
    }),
  });
}

describe("paid test verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const query = {
      select: vi.fn(),
      update: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "payment-row-1",
          user_id: "student-1",
          amount: 12,
          currency: "INR",
          status: "pending",
          metadata: { test_id: testId },
        },
        error: null,
      }),
    };
    query.select.mockReturnValue(query);
    mocks.updatePayment.mockResolvedValue({ error: null });
    query.update.mockImplementation(() => ({
      eq: vi.fn(() => ({ eq: vi.fn(() => mocks.updatePayment()) })),
    }) as never);
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => query) });
    mocks.requireAuth.mockResolvedValue({ user: { id: "student-1" }, profile: { roles: { code: "student" } } });
    mocks.requireVerifiedSession.mockReturnValue(undefined);
    mocks.unlockTestForUser.mockResolvedValue({ unlocked: true });
    mocks.fetchOrder.mockResolvedValue({ id: orderId, amount: 1200, currency: "INR" });
    mocks.fetchPayment.mockResolvedValue({
      id: paymentId,
      order_id: orderId,
      status: "captured",
      amount: 1200,
      currency: "INR",
    });
  });

  it("does not unlock a test for an authorized but uncaptured payment", async () => {
    mocks.fetchPayment.mockResolvedValue({
      id: paymentId,
      order_id: orderId,
      status: "authorized",
      amount: 1200,
      currency: "INR",
    });

    const response = await POST(request());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "PAYMENT_NOT_CAPTURED" });
    expect(mocks.unlockTestForUser).not.toHaveBeenCalled();
    expect(mocks.updatePayment).not.toHaveBeenCalled();
  });

  it("unlocks a test only after a matching captured payment is confirmed", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.fetchPayment).toHaveBeenCalledWith(paymentId);
    expect(mocks.unlockTestForUser).toHaveBeenCalledWith("student-1", testId);
    expect(mocks.updatePayment).toHaveBeenCalled();
  });
});