import { createAdminClient } from "@/lib/supabase/admin";

export type EntitlementStatus = {
  isFree: boolean;
  isPaid: boolean;
  activeSubscriptionId?: string | null;
  expiresAt?: string | null;
  productType?: string | null;
  reason?: string;
};

function normalizeProductType(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim().toLowerCase();
  }

  if (Array.isArray(value) && value.length > 0) {
    return normalizeProductType(value[0]);
  }

  return null;
}

export function isProductEntitled(
  productType: string | null | undefined,
  requiredType: "free" | "premium" | "pro" = "free"
): boolean {
  if (requiredType === "free") return true;

  const normalized = normalizeProductType(productType);
  if (!normalized) return false;

  const isPremiumAllowed = [
    "premium",
    "pro",
    "class_9_monthly",
    "class_10_season_pass",
  ].some((type) => normalized.includes(type));

  const isProAllowed = normalized.includes("pro") || normalized === "class_10_season_pass";

  if (requiredType === "premium") return isPremiumAllowed;
  if (requiredType === "pro") return isProAllowed;

  return false;
}

export async function getUserEntitlement(userId: string): Promise<EntitlementStatus> {
  const admin = createAdminClient();
  const { data: activeSubscription, error } = await admin
    .from("subscriptions")
    .select("id, status, expires_at, plan_id, subscription_plans(code, name, price, currency, duration_days)")
    .eq("user_id", userId)
    .eq("status", "active")
    .lte("starts_at", new Date().toISOString())
    .gt("expires_at", new Date().toISOString())
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const subscriptionPlans = Array.isArray(activeSubscription?.subscription_plans)
    ? activeSubscription.subscription_plans[0]
    : activeSubscription?.subscription_plans;

  const activeProductType = normalizeProductType(subscriptionPlans?.code ?? null);
  if (!activeSubscription) {
    return {
      isFree: true,
      isPaid: false,
      activeSubscriptionId: null,
      expiresAt: null,
      productType: null,
      reason: "Free access",
    };
  }

  return {
    isFree: false,
    isPaid: true,
    activeSubscriptionId: activeSubscription.id,
    expiresAt: activeSubscription.expires_at,
    productType: activeProductType,
  };
}

export async function enforceServerEntitlement(userId: string, requiredType: "free" | "premium" | "pro" = "free") {
  const entitlement = await getUserEntitlement(userId);

  if (requiredType === "free") return entitlement;

  if (!entitlement.isPaid) {
    throw new Error("Subscription required");
  }

  if (isProductEntitled(entitlement.productType, requiredType)) {
    return entitlement;
  }

  throw new Error("Required paid plan not active");
}
