import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_PRICING_RULES, type MarketplacePricingRules, type PriceRange } from "@/lib/ebooks/pricing";

/**
 * Loads and persists the admin-configurable marketplace settings. Every value is
 * optional and falls back to `DEFAULT_PRICING_RULES`, so the marketplace keeps
 * working even before an administrator opens the settings screen.
 *
 * The commission is never hard-coded: it is read from the database on every use.
 */
export const MARKETPLACE_SETTING_KEYS = {
  commissionPercent: "marketplace_commission_percent",
  minPrice: "ebook_min_price",
  maxPrice: "ebook_max_price",
  allowFree: "ebook_allow_free",
  allowedCurrencies: "ebook_allowed_currencies",
  paymentFeePercent: "ebook_payment_fee_percent",
  taxPercent: "ebook_tax_percent",
  payoutHoldDays: "ebook_payout_hold_days",
  suggestedRanges: "ebook_suggested_price_ranges",
} as const;

type SettingRow = {
  setting_key: string;
  percentage: number | string | null;
  setting_value: unknown;
};

function toNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function toStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const items = value.filter((item): item is string => typeof item === "string" && item.trim().length === 3);
  return items.length ? items.map((item) => item.toUpperCase()) : fallback;
}

function toRanges(value: unknown, fallback: PriceRange[]) {
  if (!Array.isArray(value)) return fallback;
  const ranges: PriceRange[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label : null;
    const min = toNumber(record.min, NaN);
    const max = toNumber(record.max, NaN);
    if (!label || !Number.isFinite(min) || !Number.isFinite(max)) continue;
    ranges.push({ label, min, max });
  }
  return ranges.length ? ranges : fallback;
}

export function settingsToConfig(rows: SettingRow[]): MarketplacePricingRules {
  const byKey = new Map(rows.map((row) => [row.setting_key, row]));
  const value = (key: string) => byKey.get(key)?.setting_value;
  const commissionRow = byKey.get(MARKETPLACE_SETTING_KEYS.commissionPercent);

  return {
    commissionPercent: toNumber(
      commissionRow?.percentage ?? commissionRow?.setting_value,
      DEFAULT_PRICING_RULES.commissionPercent
    ),
    minPrice: toNumber(value(MARKETPLACE_SETTING_KEYS.minPrice), DEFAULT_PRICING_RULES.minPrice),
    maxPrice: toNumber(value(MARKETPLACE_SETTING_KEYS.maxPrice), DEFAULT_PRICING_RULES.maxPrice),
    allowFree: toBoolean(value(MARKETPLACE_SETTING_KEYS.allowFree), DEFAULT_PRICING_RULES.allowFree),
    allowedCurrencies: toStringArray(value(MARKETPLACE_SETTING_KEYS.allowedCurrencies), DEFAULT_PRICING_RULES.allowedCurrencies),
    paymentFeePercent: toNumber(value(MARKETPLACE_SETTING_KEYS.paymentFeePercent), DEFAULT_PRICING_RULES.paymentFeePercent),
    taxPercent: toNumber(value(MARKETPLACE_SETTING_KEYS.taxPercent), DEFAULT_PRICING_RULES.taxPercent),
    payoutHoldDays: Math.round(toNumber(value(MARKETPLACE_SETTING_KEYS.payoutHoldDays), DEFAULT_PRICING_RULES.payoutHoldDays)),
    suggestedRanges: toRanges(value(MARKETPLACE_SETTING_KEYS.suggestedRanges), DEFAULT_PRICING_RULES.suggestedRanges),
  };
}

export function configToSettingRows(config: MarketplacePricingRules, updatedBy?: string) {
  const timestamp = new Date().toISOString();
  const base = { updated_by: updatedBy ?? null, updated_at: timestamp };
  return [
    { setting_key: MARKETPLACE_SETTING_KEYS.commissionPercent, percentage: config.commissionPercent, setting_value: null, label: "Xophol commission on each sale (%)", ...base },
    { setting_key: MARKETPLACE_SETTING_KEYS.minPrice, percentage: null, setting_value: config.minPrice, label: "Minimum listing price", ...base },
    { setting_key: MARKETPLACE_SETTING_KEYS.maxPrice, percentage: null, setting_value: config.maxPrice, label: "Maximum listing price", ...base },
    { setting_key: MARKETPLACE_SETTING_KEYS.allowFree, percentage: null, setting_value: config.allowFree, label: "Allow free eBook listings", ...base },
    { setting_key: MARKETPLACE_SETTING_KEYS.allowedCurrencies, percentage: null, setting_value: config.allowedCurrencies, label: "Allowed listing currencies", ...base },
    { setting_key: MARKETPLACE_SETTING_KEYS.paymentFeePercent, percentage: null, setting_value: config.paymentFeePercent, label: "Payment-provider fee (% of gross)", ...base },
    { setting_key: MARKETPLACE_SETTING_KEYS.taxPercent, percentage: null, setting_value: config.taxPercent, label: "Tax withheld (% of gross)", ...base },
    { setting_key: MARKETPLACE_SETTING_KEYS.payoutHoldDays, percentage: null, setting_value: config.payoutHoldDays, label: "Refund/dispute hold period (days)", ...base },
    { setting_key: MARKETPLACE_SETTING_KEYS.suggestedRanges, percentage: null, setting_value: config.suggestedRanges, label: "Suggested price ranges (guidance only)", ...base },
  ];
}

/** Reads live marketplace configuration. Falls back to defaults on any error. */
export async function getMarketplaceConfig(): Promise<MarketplacePricingRules> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ebook_marketplace_settings")
      .select("setting_key, percentage, setting_value");
    if (error) throw error;
    if (!data?.length) return DEFAULT_PRICING_RULES;
    return settingsToConfig(data as SettingRow[]);
  } catch (error) {
    console.error("Falling back to default marketplace configuration", error);
    return DEFAULT_PRICING_RULES;
  }
}
