/**
 * Pure pricing and marketplace-money helpers.
 *
 * Nothing in this module may import server-only code: it is used by client
 * components (the seller price preview), by API handlers, and by unit tests.
 */

export type PriceRange = { label: string; min: number; max: number };

export type MarketplacePricingRules = {
  /** Xophol's cut of each successful sale, as a percentage of the sale price. */
  commissionPercent: number;
  minPrice: number;
  maxPrice: number;
  allowFree: boolean;
  allowedCurrencies: string[];
  /** Guidance only. Sellers are never forced into these bands. */
  suggestedRanges: PriceRange[];
  /** Payment-provider fee, as a percentage of the gross sale price. */
  paymentFeePercent: number;
  /** Tax withheld from the sale, as a percentage of the gross sale price. */
  taxPercent: number;
  /** Days a seller balance stays pending before it becomes payable. */
  payoutHoldDays: number;
};

export const DEFAULT_PRICING_RULES: MarketplacePricingRules = {
  commissionPercent: 20,
  minPrice: 0,
  maxPrice: 100000,
  allowFree: true,
  allowedCurrencies: ["INR"],
  suggestedRanges: [
    { label: "Short notes / small guides", min: 29, max: 59 },
    { label: "Basic exam preparation", min: 59, max: 99 },
    { label: "Standard study books", min: 99, max: 199 },
    { label: "Comprehensive preparation", min: 199, max: 399 },
    { label: "Premium / large books", min: 399, max: 699 },
  ],
  paymentFeePercent: 0,
  taxPercent: 0,
  payoutHoldDays: 7,
};

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Splits a *verified* gross sale amount using the configured commission. Only
 * call this with an amount that a payment provider has already confirmed.
 */
export function splitVerifiedSale(grossAmount: number, commissionPercent: number) {
  if (!Number.isFinite(grossAmount) || grossAmount < 0) throw new Error("Gross amount must be non-negative.");
  if (!Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) {
    throw new Error("Commission percentage must be between 0 and 100.");
  }
  const grossCents = Math.round(grossAmount * 100);
  const commissionCents = Math.round((grossCents * commissionPercent) / 100);
  return {
    grossAmount: grossCents / 100,
    commissionAmount: commissionCents / 100,
    sellerAmount: (grossCents - commissionCents) / 100,
  };
}

/**
 * Full per-order settlement. Each deduction is returned on its own line so an
 * estimate is never presented as a final, all-in net payout.
 */
export function computeOrderSettlement(input: {
  grossAmount: number;
  commissionPercent: number;
  paymentFeePercent?: number;
  taxPercent?: number;
}) {
  const { grossAmount, commissionAmount, sellerAmount } = splitVerifiedSale(input.grossAmount, input.commissionPercent);
  const paymentFee = roundMoney((grossAmount * clampPercent(input.paymentFeePercent ?? 0)) / 100);
  const taxAmount = roundMoney((grossAmount * clampPercent(input.taxPercent ?? 0)) / 100);
  const sellerNetAmount = roundMoney(Math.max(0, sellerAmount - paymentFee - taxAmount));

  return {
    grossAmount,
    commissionAmount,
    sellerGrossAmount: sellerAmount,
    paymentFee,
    taxAmount,
    sellerNetAmount,
    marketplaceGrossMargin: roundMoney(commissionAmount),
  };
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function suggestedRangeForPrice(price: number, ranges: PriceRange[]): PriceRange | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  return ranges.find((range) => price >= range.min && price <= range.max) ?? null;
}

export type PriceValidation = { ok: true } | { ok: false; error: string };

export function validatePriceOffering(input: {
  price: number;
  currency: string;
  rules: MarketplacePricingRules;
}): PriceValidation {
  const { price, rules } = input;
  const currency = input.currency.trim().toUpperCase();

  if (!rules.allowedCurrencies.map((item) => item.toUpperCase()).includes(currency)) {
    return { ok: false, error: `Currency ${currency} is not enabled for the marketplace.` };
  }
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, error: "Enter a valid price." };
  }
  if (price === 0) {
    return rules.allowFree ? { ok: true } : { ok: false, error: "Free listings are currently disabled. Set a price." };
  }
  if (price < rules.minPrice) {
    return { ok: false, error: `The minimum listing price is ${rules.minPrice}.` };
  }
  if (price > rules.maxPrice) {
    return { ok: false, error: `The maximum listing price is ${rules.maxPrice}.` };
  }
  return { ok: true };
}

export type SellerEarningsEstimate = {
  price: number;
  commissionPercent: number;
  commissionAmount: number;
  sellerGrossAmount: number;
  paymentFeePercent: number;
  taxPercent: number;
};

/**
 * What a seller sees *before* publishing. This is deliberately labelled as an
 * estimate: payment-provider fees, tax and refunds are only finalised per order.
 */
export function estimateSellerEarnings(price: number, rules: MarketplacePricingRules): SellerEarningsEstimate {
  const settlement = computeOrderSettlement({
    grossAmount: Math.max(0, price),
    commissionPercent: rules.commissionPercent,
    paymentFeePercent: rules.paymentFeePercent,
    taxPercent: rules.taxPercent,
  });
  return {
    price: settlement.grossAmount,
    commissionPercent: rules.commissionPercent,
    commissionAmount: settlement.commissionAmount,
    sellerGrossAmount: settlement.sellerGrossAmount,
    paymentFeePercent: rules.paymentFeePercent,
    taxPercent: rules.taxPercent,
  };
}
