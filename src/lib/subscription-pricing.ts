export type ProductType = "free" | "class_9_monthly" | "class_10_season_pass";

export type ProductCatalogRecord = {
  id?: string;
  code: string;
  product_type: ProductType;
  board_code: string;
  class_number: 9 | 10;
  name: string;
  description?: string | null;
  price_paise: number;
  early_bird_price_paise?: number | null;
  school_price_paise?: number | null;
  duration_days?: number | null;
  validity_starts_at?: string | null;
  validity_ends_at?: string | null;
  is_active?: boolean;
  is_public?: boolean;
  metadata?: Record<string, unknown> | null;
};

export type ProductPriceDecision = {
  productType: ProductType;
  classNumber: 9 | 10;
  pricePaise: number;
  regularPricePaise: number;
  appliedRule: "regular" | "early_bird" | "school_pricing";
  schoolEligible: boolean;
  earlyBirdEligible: boolean;
  discountPaise: number;
};

const EARLY_BIRD_START = new Date("2026-11-01T00:00:00+05:30");
const EARLY_BIRD_END = new Date("2026-11-15T23:59:59+05:30");

export function isEarlyBirdWindow(now: Date = new Date()): boolean {
  return now >= EARLY_BIRD_START && now <= EARLY_BIRD_END;
}

export function resolveProductPrice(
  product: ProductCatalogRecord,
  options: {
    now?: Date;
    isSchoolEligible?: boolean;
  } = {}
): ProductPriceDecision {
  const now = options.now ?? new Date();
  const schoolEligible = Boolean(options.isSchoolEligible);
  const regularPricePaise = Number(product.price_paise ?? 0);

  const earlyBirdEligible =
    product.product_type === "class_10_season_pass" &&
    product.class_number === 10 &&
    isEarlyBirdWindow(now);

  const schoolPricePaise = product.school_price_paise ?? null;
  const earlyBirdPricePaise = product.early_bird_price_paise ?? null;

  let pricePaise = regularPricePaise;
  let appliedRule: ProductPriceDecision["appliedRule"] = "regular";

  if (schoolEligible && schoolPricePaise !== null && schoolPricePaise >= 0) {
    pricePaise = schoolPricePaise;
    appliedRule = "school_pricing";
  } else if (earlyBirdEligible && earlyBirdPricePaise !== null && earlyBirdPricePaise >= 0) {
    pricePaise = earlyBirdPricePaise;
    appliedRule = "early_bird";
  }

  return {
    productType: product.product_type,
    classNumber: product.class_number,
    pricePaise,
    regularPricePaise,
    appliedRule,
    schoolEligible,
    earlyBirdEligible,
    discountPaise: Math.max(0, regularPricePaise - pricePaise),
  };
}

export function formatPaiseAsInr(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

export function validateProductScope(product: ProductCatalogRecord): boolean {
  if (!product || !product.code || !product.name) return false;
  if (product.board_code !== "seba") return false;
  if (!([9, 10] as const).includes(product.class_number)) return false;
  if (!(["free", "class_9_monthly", "class_10_season_pass"] as const).includes(product.product_type)) {
    return false;
  }
  if (product.product_type === "free" && product.price_paise !== 0) return false;
  return true;
}
