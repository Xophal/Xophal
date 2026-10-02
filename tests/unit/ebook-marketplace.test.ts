import { describe, expect, it } from "vitest";
import { isCapturedRazorpayPayment, isEbookPaymentsEnabled } from "@/lib/ebooks/payments";
import {
  computeOrderSettlement,
  DEFAULT_PRICING_RULES,
  ebookDraftSchema,
  ebookMarketplaceConfigSchema,
  ebookPayoutOnboardingSchema,
  ebookReportSchema,
  ebookSubmissionSchema,
  estimateSellerEarnings,
  slugifyEbookTitle,
  splitVerifiedSale,
  suggestedRangeForPrice,
  validatePriceOffering,
} from "@/lib/ebooks/schema";

describe("ebook marketplace validation and accounting primitives", () => {
  it("keeps marketplace payments disabled unless explicitly enabled", () => {
    expect(isEbookPaymentsEnabled(undefined)).toBe(false);
    expect(isEbookPaymentsEnabled("false")).toBe(false);
    expect(isEbookPaymentsEnabled("true")).toBe(true);
  });

  it("accepts only captured Razorpay payments matching the expected order and settlement", () => {
    const expected = { paymentId: "pay_123", orderId: "order_123", amountMinor: 9900, currency: "INR" };
    const payment = { id: "pay_123", order_id: "order_123", status: "captured", amount: 9900, currency: "INR" };

    expect(isCapturedRazorpayPayment(payment, expected)).toBe(true);
    expect(isCapturedRazorpayPayment({ ...payment, status: "authorized" }, expected)).toBe(false);
    expect(isCapturedRazorpayPayment({ ...payment, amount: 100 }, expected)).toBe(false);
    expect(isCapturedRazorpayPayment({ ...payment, currency: "USD" }, expected)).toBe(false);
    expect(isCapturedRazorpayPayment({ ...payment, order_id: "order_other" }, expected)).toBe(false);
  });

  it("normalizes listing slugs without inventing an empty slug", () => {
    expect(slugifyEbookTitle("Assam GK: A Student's Guide!")).toBe("assam-gk-a-student-s-guide");
    expect(slugifyEbookTitle("অসমীয়া")).toBe("");
  });

  it("allows incomplete private drafts but does not weaken review submission validation", () => {
    expect(ebookDraftSchema.safeParse({ title: "My working draft", rightsConfirmed: false }).success).toBe(true);
    expect(ebookDraftSchema.safeParse({ externalProductUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(ebookSubmissionSchema.safeParse({ title: "Complete book", rightsConfirmed: false }).success).toBe(false);
  });

  it("requires all rights declarations and valid product destinations", () => {
    const result = ebookSubmissionSchema.safeParse({
      title: "A useful exam guide",
      authorName: "A Teacher",
      shortDescription: "A detailed guide for exam revision and practice.",
      fullDescription: "A complete guide with clear lessons and examples for students preparing for their examinations.",
      categoryId: "00000000-0000-4000-8000-000000000001",
      language: "English",
      price: 100,
      currency: "inr",
      coverImageUrl: "https://images.example/book.jpg",
      externalProductUrl: "javascript:alert(1)",
      rightsConfirmed: false,
    });
    expect(result.success).toBe(false);
  });

  it("splits only an explicitly supplied verified gross amount using the configured rate", () => {
    expect(splitVerifiedSale(100, 20)).toEqual({ grossAmount: 100, commissionAmount: 20, sellerAmount: 80 });
    expect(splitVerifiedSale(9.99, 15)).toEqual({ grossAmount: 9.99, commissionAmount: 1.5, sellerAmount: 8.49 });
    expect(() => splitVerifiedSale(100, 101)).toThrow();
  });

  it("accepts only supported report reasons", () => {
    expect(ebookReportSchema.safeParse({
      ebookId: "00000000-0000-4000-8000-000000000001",
      reason: "copyright",
      details: "The listing appears to use a copyrighted cover.",
    }).success).toBe(true);
    expect(ebookReportSchema.safeParse({
      ebookId: "00000000-0000-4000-8000-000000000001",
      reason: "something-else",
      details: "This report reason is not supported.",
    }).success).toBe(false);
  });

  it("validates a price offering against the live marketplace rules", () => {
    const rules = {
      ...DEFAULT_PRICING_RULES,
      minPrice: 49,
      maxPrice: 999,
      allowFree: false,
      allowedCurrencies: ["INR"],
    };

    expect(validatePriceOffering({ price: 0, currency: "INR", rules })).toEqual({
      ok: false,
      error: "Free listings are currently disabled. Set a price.",
    });
    expect(validatePriceOffering({ price: 20, currency: "INR", rules }).ok).toBe(false);
    expect(validatePriceOffering({ price: 1000, currency: "INR", rules }).ok).toBe(false);
    expect(validatePriceOffering({ price: 500, currency: "inr", rules })).toEqual({ ok: true });
    expect(validatePriceOffering({ price: 500, currency: "USD", rules }).ok).toBe(false);
    expect(validatePriceOffering({ price: 0, currency: "INR", rules: { ...rules, allowFree: true } })).toEqual({ ok: true });
  });

  it("deducts provider fees and tax from the seller payout without going negative", () => {
    expect(
      computeOrderSettlement({ grossAmount: 200, commissionPercent: 20, paymentFeePercent: 2, taxPercent: 1 })
    ).toEqual({
      grossAmount: 200,
      commissionAmount: 40,
      sellerGrossAmount: 160,
      paymentFee: 4,
      taxAmount: 2,
      sellerNetAmount: 154,
      marketplaceGrossMargin: 40,
    });
    expect(
      computeOrderSettlement({ grossAmount: 10, commissionPercent: 50, paymentFeePercent: 10, taxPercent: 90 }).sellerNetAmount
    ).toBe(0);
  });

  it("estimates seller earnings from the configured commission only", () => {
    expect(estimateSellerEarnings(100, DEFAULT_PRICING_RULES)).toEqual({
      price: 100,
      commissionPercent: 20,
      commissionAmount: 20,
      sellerGrossAmount: 80,
      paymentFeePercent: 0,
      taxPercent: 0,
    });
    expect(suggestedRangeForPrice(120, DEFAULT_PRICING_RULES.suggestedRanges)?.label).toBe("Standard study books");
    expect(suggestedRangeForPrice(0, DEFAULT_PRICING_RULES.suggestedRanges)).toBeNull();
  });

  it("rejects an admin marketplace config with impossible pricing bands", () => {
    const base = {
      commissionPercent: 20,
      minPrice: 0,
      maxPrice: 100,
      allowFree: true,
      allowedCurrencies: ["INR"],
      paymentFeePercent: 0,
      taxPercent: 0,
      payoutHoldDays: 7,
      suggestedRanges: [],
    };

    expect(ebookMarketplaceConfigSchema.safeParse(base).success).toBe(true);
    expect(ebookMarketplaceConfigSchema.safeParse({ ...base, minPrice: 50, maxPrice: 0 }).success).toBe(false);
    expect(ebookMarketplaceConfigSchema.safeParse({ ...base, commissionPercent: 120 }).success).toBe(false);
    expect(ebookMarketplaceConfigSchema.safeParse({ ...base, allowedCurrencies: [] }).success).toBe(false);
  });

  it("validates individual Route onboarding and settlement details", () => {
    const input = {
      legalBusinessName: "Asha Kumar",
      businessType: "individual",
      pan: "ABCDE1234F",
      phone: "+919876543210",
      tncAccepted: true,
      settlementAccount: {
        method: "bank_account",
        accountNumber: "123456789012",
        beneficiaryName: "Asha Kumar",
        ifsc: "HDFC0000317",
      },
    };

    expect(ebookPayoutOnboardingSchema.safeParse(input).success).toBe(true);
    expect(ebookPayoutOnboardingSchema.safeParse({ ...input, pan: "not-a-pan" }).success).toBe(false);
    expect(ebookPayoutOnboardingSchema.safeParse({ ...input, businessType: "private_limited" }).success).toBe(false);
  });
});