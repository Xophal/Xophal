import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/env.server", () => ({
  serverEnv: { RAZORPAY_WEBHOOK_SECRET: "webhook-secret" },
}));

import { POST } from "@/app/api/webhooks/razorpay/route";

function request(body: unknown) {
  const rawBody = JSON.stringify(body);
  const signature = createHmac("sha256", "webhook-secret").update(rawBody).digest("hex");
  return new NextRequest("http://localhost/api/webhooks/razorpay", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-razorpay-signature": signature },
    body: rawBody,
  });
}

describe("POST /api/webhooks/razorpay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const paymentQuery = {
      select: vi.fn(() => paymentQuery),
      eq: vi.fn(() => paymentQuery),
      maybeSingle: mocks.maybeSingle,
      update: mocks.update,
    };
    mocks.maybeSingle.mockResolvedValue({
      data: { id: "payment-1", final_amount: 49, currency: "INR", status: "pending" },
      error: null,
    });
    const updateQuery = {
      eq: mocks.updateEq,
      then: (resolve: (value: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resolve),
    };
    mocks.updateEq.mockReturnValue(updateQuery);
    mocks.update.mockReturnValue(updateQuery);
    mocks.rpc.mockResolvedValue({ data: { already_fulfilled: false }, error: null });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => paymentQuery),
      rpc: mocks.rpc,
    });
  });

  it("uses atomic fulfillment for a matching captured subscription payment", async () => {
    const response = await POST(request({
      event: "payment.captured",
      payload: { payment: { entity: {
        id: "pay-1",
        order_id: "order-1",
        status: "captured",
        amount: 4900,
        currency: "INR",
      } } },
    }));

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("fulfill_subscription_payment", {
      p_order_id: "order-1",
      p_payment_id: "pay-1",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects a captured payment whose currency or amount differs from the stored order", async () => {
    const response = await POST(request({
      event: "payment.captured",
      payload: { payment: { entity: {
        id: "pay-1",
        order_id: "order-1",
        status: "captured",
        amount: 1,
        currency: "INR",
      } } },
    }));

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not downgrade a paid order when a late failure event arrives", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { id: "payment-1", final_amount: 49, currency: "INR", status: "paid" },
      error: null,
    });

    const response = await POST(request({
      event: "payment.failed",
      payload: { payment: { entity: {
        id: "pay-1",
        order_id: "order-1",
        status: "failed",
      } } },
    }));

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalled();
    expect(mocks.updateEq).toHaveBeenCalledWith("status", "pending");
  });
});
