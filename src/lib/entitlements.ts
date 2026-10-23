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

async function getApprovedProductEntitlement(userId: string): Promise<EntitlementStatus | null> {
  const admin = createAdminClient();
  const { data: approvedSubmissions, error } = await admin
    .from("payment_submissions")
    .select("id, approved_at, subscription_id, product_snapshot, product_catalog(code, name, product_type, duration_days)")
    .eq("user_id", userId)
    .eq("status", "approved")
    .is("subscription_id", null)
    .order("approved_at", { ascending: false })
    .limit(25);

  if (error) throw error;

  const eligible = (approvedSubmissions ?? []).reduce<EntitlementStatus | null>((best, submission) => {
    const snapshot = submission?.product_snapshot as {
      product_type?: unknown;
      validity_starts_at?: unknown;
      validity_ends_at?: unknown;
      duration_days?: unknown;
    } | null;
    const productCatalog = Array.isArray(submission?.product_catalog)
      ? submission.product_catalog[0]
      : submission?.product_catalog;
    const productType = normalizeProductType(snapshot?.product_type ?? productCatalog?.product_type ?? null);
    const approvedAt = submission?.approved_at ? new Date(submission.approved_at) : null;
    const snapshotExpiry = typeof snapshot?.validity_ends_at === "string"
      ? new Date(snapshot.validity_ends_at)
      : null;
    const snapshotStart = typeof snapshot?.validity_starts_at === "string"
      ? new Date(snapshot.validity_starts_at)
      : null;
    const durationDays = Number(snapshot?.duration_days ?? productCatalog?.duration_days ?? 0);

    if (!productType || !approvedAt || !Number.isFinite(approvedAt.getTime())) {
      return best;
    }

    const expiresAtDate = snapshotExpiry && Number.isFinite(snapshotExpiry.getTime())
      ? snapshotExpiry
      : durationDays > 0
      ? new Date(approvedAt.getTime() + durationDays * 24 * 60 * 60 * 1000)
      : approvedAt;

    if (
      expiresAtDate.getTime() <= Date.now() ||
      (snapshotStart && Number.isFinite(snapshotStart.getTime()) && snapshotStart.getTime() > Date.now())
    ) {
      return best;
    }

    const candidate: EntitlementStatus = {
      isFree: false,
      isPaid: true,
      activeSubscriptionId: submission?.id ?? null,
      expiresAt: expiresAtDate.toISOString(),
      productType,
      reason: "Approved product access",
    };

    if (!best || new Date(best.expiresAt ?? 0).getTime() < expiresAtDate.getTime()) {
      return candidate;
    }

    return best;
  }, null);

  return eligible;
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
  const approvedProductEntitlement = await getApprovedProductEntitlement(userId);
  const candidates = [
    {
      isFree: !activeSubscription,
      isPaid: Boolean(activeSubscription),
      activeSubscriptionId: activeSubscription?.id ?? null,
      expiresAt: activeSubscription?.expires_at ?? null,
      productType: activeProductType,
      reason: activeSubscription ? undefined : "Free access",
    } as EntitlementStatus,
    approvedProductEntitlement,
  ].filter(Boolean) as EntitlementStatus[];

  if (candidates.length === 0) {
    return {
      isFree: true,
      isPaid: false,
      activeSubscriptionId: null,
      expiresAt: null,
      productType: null,
      reason: "Free access",
    };
  }

  const winner = candidates.reduce((best, candidate) => {
    if (!best) return candidate;
    const bestExpiresAt = best.expiresAt ? new Date(best.expiresAt).getTime() : 0;
    const candidateExpiresAt = candidate.expiresAt ? new Date(candidate.expiresAt).getTime() : 0;
    return candidateExpiresAt > bestExpiresAt ? candidate : best;
  }, candidates[0]);

  return winner;
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
