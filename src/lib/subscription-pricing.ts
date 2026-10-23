export type ProductType = "free" | "premium" | "pro" | "class_9_monthly" | "class_10_season_pass";

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
  early_bird_starts_at?: string | null;
  early_bird_ends_at?: string | null;
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

export function isEarlyBirdWindow(
  product: Pick<ProductCatalogRecord, "early_bird_starts_at" | "early_bird_ends_at">,
  now: Date = new Date()
): boolean {
  const startsAt = product.early_bird_starts_at ? new Date(product.early_bird_starts_at) : null;
  const endsAt = product.early_bird_ends_at ? new Date(product.early_bird_ends_at) : null;
  if ((startsAt && !Number.isFinite(startsAt.getTime())) || (endsAt && !Number.isFinite(endsAt.getTime()))) {
    return false;
  }
  return (!startsAt || now >= startsAt) && (!endsAt || now < endsAt);
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

  const earlyBirdPricePaise = product.early_bird_price_paise ?? null;
  const earlyBirdEligible =
    product.class_number === 10 &&
    earlyBirdPricePaise !== null &&
    isEarlyBirdWindow(product, now);

  const schoolPricePaise = product.school_price_paise ?? null;

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
  if (!(["free", "premium", "pro", "class_9_monthly", "class_10_season_pass"] as const).includes(product.product_type)) {
    return false;
  }
  if (product.product_type === "free" && product.price_paise !== 0) return false;
  if (product.product_type === "class_9_monthly" && product.class_number !== 9) return false;
  if (product.product_type === "class_10_season_pass" && product.class_number !== 10) return false;
  return true;
}
