import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireVerifiedSession: vi.fn(),
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  checkRateLimit: vi.fn(),
  createOrder: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/auth-policy", () => ({ requireVerifiedSession: mocks.requireVerifiedSession }));
vi.mock("@/lib/api-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-utils")>();
  return { ...actual, assertTrustedOrigin: vi.fn() };
});
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/env.server", () => ({
  serverEnv: { RAZORPAY_KEY_ID: "rzp_test_public", RAZORPAY_KEY_SECRET: "test-secret" },
}));
vi.mock("razorpay", () => ({
  default: class RazorpayMock {
    orders = { create: mocks.createOrder };
  },
}));

import { POST } from "@/app/api/payments/route";

const planId = "00000000-0000-4000-8000-000000000001";
const idempotencyKey = "00000000-0000-4000-8000-000000000002";

function queryResult(data: unknown) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.gt = vi.fn(() => query);
  query.is = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  query.insert = vi.fn(() => query);
  query.single = vi.fn().mockResolvedValue({ data: { id: "payment-row" }, error: null });
  return query;
}

function setupAdmin({ existingPayment = null as Record<string, unknown> | null } = {}) {
  const planQuery = queryResult({
    id: planId,
    name: "Premium Monthly",
    price: 299,
    currency: "INR",
    duration_days: 30,
  });
  const subscriptionQuery = queryResult(null);
  const existingPaymentQuery = queryResult(existingPayment);
  const insertQuery = queryResult(null);
  insertQuery.single.mockResolvedValue({ data: { id: "payment-row" }, error: null });
  const updateQuery = queryResult({ id: "payment-row" });
  insertQuery.update = vi.fn(() => updateQuery);
  const admin = {
    from: vi.fn((table: string) => {
      if (table === "subscription_plans") return planQuery;
      if (table === "subscriptions") return subscriptionQuery;
      if (table === "payments" && existingPayment) return existingPaymentQuery;
      if (table === "payments") return insertQuery;
      throw new Error(`Unexpected table: ${table}`);
    }),
    planQuery,
    subscriptionQuery,
    existingPaymentQuery,
    insertQuery,
    updateQuery,
  };
  mocks.createAdminClient.mockReturnValue(admin);
  return admin;
}

function request(body: unknown, key = idempotencyKey) {
  return new NextRequest("http://localhost/api/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(body),
  });
}

describe("POST /api/payments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({
      user: { id: "user-123" },
      profile: { id: "user-123" },
    });
    mocks.createClient.mockResolvedValue({});
    mocks.createOrder.mockResolvedValue({ id: "order_123" });
  });

  it("uses trusted plan pricing and returns only checkout data", async () => {
    const admin = setupAdmin();
    const response = await POST(request({ planId, amount: 1, currency: "USD", metadata: { user_id: "other-user" } }));

    expect(response.status).toBe(201);
    expect(mocks.createOrder).toHaveBeenCalledWith(expect.objectContaining({ amount: 29900, currency: "INR" }));
    expect(admin.insertQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        user_id: "user-123",
        plan_id: planId,
        amount: 299,
        final_amount: 299,
        currency: "INR",
        checkout_idempotency_key: idempotencyKey,
      }),
    ]);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { paymentId: "payment-row", keyId: "rzp_test_public", order: { id: "order_123", amount: 29900 } },
    });
  });

  it("rejects unauthenticated checkout before creating an order", async () => {
    mocks.requireAuth.mockResolvedValue(null);
    const response = await POST(request({ planId }));

    expect(response.status).toBe(401);
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("reuses the stored order for a repeated idempotency key", async () => {
    setupAdmin({
      existingPayment: {
        id: "existing-payment",
        plan_id: planId,
        amount: 299,
        currency: "INR",
        status: "pending",
        razorpay_order_id: "order_existing",
      } as const,
    });

    const response = await POST(request({ planId }));

    expect(response.status).toBe(200);
    expect(mocks.createOrder).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      data: { paymentId: "existing-payment", order: { id: "order_existing", amount: 29900 } },
    });
  });
});