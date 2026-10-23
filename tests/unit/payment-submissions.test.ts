import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireVerifiedSession: vi.fn(),
  requireAdminRole: vi.fn(),
  createAdminClient: vi.fn(),
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

import { POST as submitPayment } from "@/app/api/payments/submissions/route";
import { PATCH as approveSubmission } from "@/app/api/admin/payment-submissions/[id]/route";

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

  it("creates a pending payment submission for a valid product and rejects price mismatch", async () => {
    const product = {
      id: "11111111-1111-4111-8111-111111111111",
      code: "seba_class_9_monthly",
      product_type: "class_9_monthly",
      board_code: "seba",
      class_number: 9,
      name: "SEBA Class 9 Monthly",
      price_paise: 14900,
      early_bird_price_paise: 12900,
      school_price_paise: null,
      is_active: true,
    };

    const productQuery = createQuery(product);
    const duplicateQuery = createQuery(null);
    const insertQuery = createQuery({
      id: "submission-123",
      status: "pending_verification",
      product_id: product.id,
      amount_minor: 14900,
      final_amount_minor: 14900,
    });

    let paymentSubmissionCallCount = 0;

    mocks.requireAuth.mockResolvedValue({
      user: { id: "user-123" },
      profile: { id: "user-123", email_verified: true, is_active: true },
    });
    mocks.requireVerifiedSession.mockReturnValue({ isAuthenticated: true });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "product_catalog") return productQuery;
        if (table === "payment_submissions") {
          paymentSubmissionCallCount += 1;
          return paymentSubmissionCallCount === 1 ? duplicateQuery : insertQuery;
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const response = await submitPayment(new NextRequest("http://localhost/api/payments/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: product.id, amount_minor: 14900, reference_code: "UPI-REF-123", evidence_url: "https://example.com/evidence.png" }),
    }));

    expect(response.status).toBe(201);
    expect(mocks.createAdminClient).toHaveBeenCalled();

    const mismatchResponse = await submitPayment(new NextRequest("http://localhost/api/payments/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: product.id, amount_minor: 12000, reference_code: "UPI-REF-456", evidence_url: "https://example.com/evidence2.png" }),
    }));

    expect(mismatchResponse.status).toBe(400);
    await expect(mismatchResponse.json()).resolves.toMatchObject({
      success: false,
      code: "PRICE_MISMATCH",
    });
  });

  it("requires verified, user-specific school eligibility before applying school pricing", async () => {
    const product = {
      id: "11111111-1111-4111-8111-111111111111",
      code: "seba_class_9_monthly",
      product_type: "class_9_monthly",
      board_code: "seba",
      class_number: 9,
      name: "SEBA Class 9 Monthly",
      price_paise: 14900,
      early_bird_price_paise: null,
      school_price_paise: 9900,
      is_active: true,
    };
    const productQuery = createQuery(product);
    const eligibilityQuery = createQuery({
      id: "eligibility-1",
      school_id: "22222222-2222-4222-8222-222222222222",
      student_id: "user-123",
    });
    const schoolQuery = createQuery({ is_verified: true });
    const duplicateQuery = createQuery(null);
    const insertQuery = createQuery({ id: "submission-school", status: "pending_verification" });

    mocks.requireAuth.mockResolvedValue({
      user: { id: "user-123" },
      profile: { id: "user-123", email_verified: true, is_active: true },
    });
    mocks.requireVerifiedSession.mockReturnValue({ isAuthenticated: true });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "product_catalog") return productQuery;
        if (table === "school_student_eligibility") return eligibilityQuery;
        if (table === "school_records") return schoolQuery;
        if (table === "payment_submissions") {
          return duplicateQuery.maybeSingle.mock.calls.length ? insertQuery : duplicateQuery;
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const response = await submitPayment(new NextRequest("http://localhost/api/payments/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: product.id,
        school_id: "22222222-2222-4222-8222-222222222222",
        amount_minor: 9900,
        reference_code: "UPI-SCHOOL-123",
      }),
    }));

    expect(response.status).toBe(201);
    expect(eligibilityQuery.eq).toHaveBeenCalledWith("student_id", "user-123");
    expect(eligibilityQuery.or).toHaveBeenCalledWith(`product_id.is.null,product_id.eq.${product.id}`);
    expect(eligibilityQuery.not).toHaveBeenCalledWith("verified_at", "is", null);
    expect(insertQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({ amount_minor: 9900, discount_minor: 5000 }),
    ]);
  });

  it("rejects school pricing when the user has no verified eligibility record", async () => {
    const product = {
      id: "11111111-1111-4111-8111-111111111111",
      code: "seba_class_9_monthly",
      product_type: "class_9_monthly",
      board_code: "seba",
      class_number: 9,
      name: "SEBA Class 9 Monthly",
      price_paise: 14900,
      early_bird_price_paise: null,
      school_price_paise: 9900,
      is_active: true,
    };
    const productQuery = createQuery(product);
    const eligibilityQuery = createQuery(null);

    mocks.requireAuth.mockResolvedValue({
      user: { id: "user-123" },
      profile: { id: "user-123", email_verified: true, is_active: true },
    });
    mocks.requireVerifiedSession.mockReturnValue({ isAuthenticated: true });
    const from = vi.fn((table: string) => {
      if (table === "product_catalog") return productQuery;
      if (table === "school_student_eligibility") return eligibilityQuery;
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createAdminClient.mockReturnValue({ from });

    const response = await submitPayment(new NextRequest("http://localhost/api/payments/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: product.id,
        school_id: "22222222-2222-4222-8222-222222222222",
        amount_minor: 9900,
        reference_code: "UPI-SCHOOL-456",
      }),
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "SCHOOL_ELIGIBILITY_REQUIRED",
    });
    expect(from).not.toHaveBeenCalledWith("payment_submissions");
  });

  it("allows a payment verifier to approve a pending submission", async () => {
    const existing = { id: "submission-456", status: "pending_verification", reason: null };
    const updated = { ...existing, status: "approved", approved_by: "admin-123" };

    const fetchQuery = createQuery(existing);
    const updateQuery = createQuery(updated);
    let adminFromCallCount = 0;

    mocks.requireAdminRole.mockResolvedValue({
      user: { id: "admin-123" },
      profile: { id: "admin-123", email_verified: true, is_active: true },
    });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "payment_submissions") throw new Error(`Unexpected table: ${table}`);
        adminFromCallCount += 1;
        return adminFromCallCount === 1 ? fetchQuery : updateQuery;
      }),
    });

    const response = await approveSubmission(new NextRequest("http://localhost/api/admin/payment-submissions/submission-456", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved", reason: "Verified via UPI reference" }),
    }), { params: Promise.resolve({ id: "submission-456" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: expect.objectContaining({ status: "approved" }),
    });
  });
});
