import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireVerifiedSession: vi.fn(),
  requireAdminRole: vi.fn(),
  createAdminClient: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: mocks.requireAuth,
  requireAdminRole: mocks.requireAdminRole,
}));

vi.mock("@/lib/auth-policy", () => ({
  requireVerifiedSession: mocks.requireVerifiedSession,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

import { POST as submitPayment } from "@/app/api/payments/submissions/route";
import { PATCH as approveSubmission } from "@/app/api/admin/payment-submissions/[id]/route";

const REQUEST_ID = "33333333-3333-4333-8333-333333333333";

function createPaymentRequest(fields: Record<string, string>) {
  const formData = new FormData();
  formData.set("payment_request_id", REQUEST_ID);
  formData.set("payment_paid_at", "2026-10-24T12:00");
  formData.set("claimed_amount", "49.00");
  formData.set("reference_code", "UPI-REF-123");
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  formData.set("receipt", new File([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  ], "receipt.png", { type: "image/png" }));

  return new NextRequest("http://localhost/api/payments/submissions", {
    method: "POST",
    body: formData,
  });
}

function createStorageMock() {
  const bucket = {
    upload: vi.fn().mockResolvedValue({ data: { path: "user/receipt.png" }, error: null }),
    remove: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  return { from: vi.fn(() => bucket), bucket };
}

function createQuery(data: unknown) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.or = vi.fn(() => query);
  query.not = vi.fn(() => query);
  query.in = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.range = vi.fn(() => query);
  query.maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  query.single = vi.fn().mockResolvedValue({ data, error: null });
  query.update = vi.fn(() => query);
  query.insert = vi.fn(() => query);
  return query;
}

describe("manual payment submissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a pending submission while keeping the claimed amount separate from the expected price", async () => {
    const product = {
      id: "11111111-1111-4111-8111-111111111111",
      code: "seba_class_9_monthly",
      product_type: "premium",
      board_code: "seba",
      class_number: 9,
      name: "Class 9 Premium",
      price_paise: 4900,
      duration_days: 30,
      early_bird_price_paise: null,
      school_price_paise: null,
      is_active: true,
    };

    const productQuery = createQuery(product);
    const requestIdQuery = createQuery(null);
    const duplicateQuery = createQuery(null);
    const insertQuery = createQuery({
      id: REQUEST_ID,
      status: "pending_verification",
      product_id: product.id,
      amount_minor: 4900,
      claimed_amount_minor: 1200,
      final_amount_minor: 4900,
    });
    const settingsQuery = createQuery({ upi_id: "merchant@bank", is_enabled: true });
    const storage = createStorageMock();

    let paymentSubmissionCallCount = 0;

    mocks.requireAuth.mockResolvedValue({
      user: { id: "user-123" },
      profile: { id: "user-123", email_verified: true, is_active: true },
    });
    mocks.requireVerifiedSession.mockReturnValue({ isAuthenticated: true });
    mocks.createAdminClient.mockReturnValue({
      storage: storage,
      from: vi.fn((table: string) => {
        if (table === "manual_payment_settings") return settingsQuery;
        if (table === "product_catalog") return productQuery;
        if (table === "payment_submissions") {
          paymentSubmissionCallCount += 1;
          if (paymentSubmissionCallCount === 1) return requestIdQuery;
          if (paymentSubmissionCallCount === 2) return duplicateQuery;
          return insertQuery;
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const response = await submitPayment(createPaymentRequest({
      product_id: product.id,
      claimed_amount: "12.00",
    }));

    expect(response.status).toBe(201);
    expect(mocks.createAdminClient).toHaveBeenCalled();
    expect(storage.bucket.upload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^user-123/${REQUEST_ID}-[0-9a-f-]+\\.png$`)),
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: "image/png", upsert: false })
    );
    expect(insertQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        amount_minor: 4900,
        claimed_amount_minor: 1200,
        id: REQUEST_ID,
        status: "pending_verification",
      }),
    ]);
    const inserted = await response.json();
    expect(inserted.data.id).toBe(REQUEST_ID);
    expect(inserted.data.amount_minor).toBe(4900);
    expect(inserted.data.claimed_amount_minor).toBe(1200);
  });

  it("requires verified, user-specific school eligibility before applying school pricing", async () => {
    const product = {
      id: "11111111-1111-4111-8111-111111111111",
      code: "seba_class_10_premium",
      product_type: "premium",
      board_code: "seba",
      class_number: 10,
      name: "HSLC 2027 Premium",
      price_paise: 19900,
      early_bird_price_paise: null,
      school_price_paise: 9900,
      validity_starts_at: "2026-11-01T00:00:00+05:30",
      validity_ends_at: "2027-03-31T23:59:59+05:30",
      is_active: true,
    };
    const productQuery = createQuery(product);
    const eligibilityQuery = createQuery({
      id: "eligibility-1",
      school_id: "22222222-2222-4222-8222-222222222222",
      student_id: "user-123",
    });
    const schoolQuery = createQuery({
      is_verified: true,
      class_10_total_students: 100,
      class_10_covered_students: 80,
      name: "Verified School",
    });
    const requestIdQuery = createQuery(null);
    const duplicateQuery = createQuery(null);
    const insertQuery = createQuery({ id: "submission-school", status: "pending_verification" });
    const settingsQuery = createQuery({ upi_id: "merchant@bank", is_enabled: true });
    const storage = createStorageMock();

    mocks.requireAuth.mockResolvedValue({
      user: { id: "user-123" },
      profile: { id: "user-123", email_verified: true, is_active: true },
    });
    mocks.requireVerifiedSession.mockReturnValue({ isAuthenticated: true });
    mocks.createAdminClient.mockReturnValue({
      storage: storage,
      from: vi.fn((table: string) => {
        if (table === "manual_payment_settings") return settingsQuery;
        if (table === "product_catalog") return productQuery;
        if (table === "school_student_eligibility") return eligibilityQuery;
        if (table === "school_records") return schoolQuery;
        if (table === "payment_submissions") {
          if (requestIdQuery.maybeSingle.mock.calls.length === 0) return requestIdQuery;
          return duplicateQuery.maybeSingle.mock.calls.length ? insertQuery : duplicateQuery;
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const response = await submitPayment(createPaymentRequest({
      product_id: product.id,
      school_id: "22222222-2222-4222-8222-222222222222",
    }));

    expect(response.status).toBe(201);
    expect(eligibilityQuery.eq).toHaveBeenCalledWith("student_id", "user-123");
    expect(eligibilityQuery.or).toHaveBeenCalledWith(`product_id.is.null,product_id.eq.${product.id}`);
    expect(eligibilityQuery.not).toHaveBeenCalledWith("verified_at", "is", null);
    expect(insertQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        amount_minor: 9900,
        claimed_amount_minor: 4900,
        discount_minor: 10000,
        id: REQUEST_ID,
        status: "pending_verification",
      }),
    ]);
  });

  it("rejects school pricing when the user has no verified eligibility record", async () => {
    const product = {
      id: "11111111-1111-4111-8111-111111111111",
      code: "seba_class_10_premium",
      product_type: "premium",
      board_code: "seba",
      class_number: 10,
      name: "HSLC 2027 Premium",
      price_paise: 19900,
      early_bird_price_paise: null,
      school_price_paise: 9900,
      validity_starts_at: "2026-11-01T00:00:00+05:30",
      validity_ends_at: "2027-03-31T23:59:59+05:30",
      is_active: true,
    };
    const productQuery = createQuery(product);
    const eligibilityQuery = createQuery(null);
    const settingsQuery = createQuery({ upi_id: "merchant@bank", is_enabled: true });

    mocks.requireAuth.mockResolvedValue({
      user: { id: "user-123" },
      profile: { id: "user-123", email_verified: true, is_active: true },
    });
    mocks.requireVerifiedSession.mockReturnValue({ isAuthenticated: true });
    const from = vi.fn((table: string) => {
      if (table === "manual_payment_settings") return settingsQuery;
      if (table === "product_catalog") return productQuery;
      if (table === "school_student_eligibility") return eligibilityQuery;
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createAdminClient.mockReturnValue({ from });

    const response = await submitPayment(createPaymentRequest({
      product_id: product.id,
      school_id: "22222222-2222-4222-8222-222222222222",
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "SCHOOL_ELIGIBILITY_REQUIRED",
    });
    expect(from).not.toHaveBeenCalledWith("payment_submissions");
  });

  it("approves a payment through the atomic subscription-granting database function", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        status: "approved",
        subscription_id: "subscription-123",
        starts_at: "2026-10-24T00:00:00.000Z",
        expires_at: "2026-11-23T00:00:00.000Z",
      },
      error: null,
    });

    mocks.requireAdminRole.mockResolvedValue({
      user: { id: "admin-123" },
      profile: { id: "admin-123", email_verified: true, is_active: true },
    });
    mocks.createAdminClient.mockReturnValue({ rpc });

    const response = await approveSubmission(new NextRequest("http://localhost/api/admin/payment-submissions/submission-456", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved", reason: "Verified via UPI reference" }),
    }), { params: Promise.resolve({ id: "submission-456" }) });

    expect(response.status).toBe(200);
    expect(mocks.requireAdminRole).toHaveBeenCalledWith(["payment_verifier", "subscription_admin"]);
    expect(rpc).toHaveBeenCalledWith("resolve_manual_payment_submission", {
      p_submission_id: "submission-456",
      p_actor_id: "admin-123",
      p_status: "approved",
      p_reason: "Verified via UPI reference",
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: expect.objectContaining({ status: "approved", subscription_id: "subscription-123" }),
    });
  });

  it("rejects a payment through the database review function", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: "rejected" }, error: null });
    mocks.requireAdminRole.mockResolvedValue({ user: { id: "admin-123" } });
    mocks.createAdminClient.mockReturnValue({ rpc });

    const response = await approveSubmission(new NextRequest("http://localhost/api/admin/payment-submissions/submission-456", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected", reason: "Reference not found" }),
    }), { params: Promise.resolve({ id: "submission-456" }) });

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("resolve_manual_payment_submission", {
      p_submission_id: "submission-456",
      p_actor_id: "admin-123",
      p_status: "rejected",
      p_reason: "Reference not found",
    });
  });

  it("does not silently accept payment requests when manual UPI settings are missing", async () => {
    const settingsQuery = createQuery(null);
    const from = vi.fn((table: string) => {
      if (table === "manual_payment_settings") return settingsQuery;
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.requireAuth.mockResolvedValue({
      user: { id: "user-123" },
      profile: { id: "user-123", email_verified: true, is_active: true },
    });
    mocks.requireVerifiedSession.mockReturnValue({ isAuthenticated: true });
    mocks.createAdminClient.mockReturnValue({ from });

    const response = await submitPayment(createPaymentRequest({
      product_id: "11111111-1111-4111-8111-111111111111",
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "MANUAL_PAYMENTS_NOT_CONFIGURED",
    });
    expect(from).not.toHaveBeenCalledWith("product_catalog");
  });

  it("returns a conflict when a submission was already reviewed", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Payment submission has already been reviewed" },
    });
    mocks.requireAdminRole.mockResolvedValue({ user: { id: "admin-123" } });
    mocks.createAdminClient.mockReturnValue({ rpc });

    const response = await approveSubmission(new NextRequest("http://localhost/api/admin/payment-submissions/submission-456", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    }), { params: Promise.resolve({ id: "submission-456" }) });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "SUBMISSION_ALREADY_REVIEWED",
    });
  });
});
