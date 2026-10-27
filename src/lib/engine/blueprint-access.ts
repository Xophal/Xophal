import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api-utils";
import { getUserEntitlement, isProductEntitled } from "@/lib/entitlements";

type Admin = SupabaseClient;

export function canAccessLinkedMockTest(input: {
  isPremium: boolean;
  hasPremiumEntitlement: boolean;
  hasGrant: boolean;
}): boolean {
  return !input.isPremium || input.hasPremiumEntitlement || input.hasGrant;
}

export async function requireLinkedMockTestAccess(
  admin: Admin,
  userId: string,
  sourceMockTestId: string | null
) {
  if (!sourceMockTestId) {
    return { maxAttempts: 0, showSolutions: true };
  }

  const { data: test, error: testError } = await admin
    .from("mock_tests")
    .select("id,is_active,is_published,is_premium,max_attempts,show_solutions")
    .eq("id", sourceMockTestId)
    .maybeSingle();
  if (testError) throw testError;
  if (!test?.is_active || !test.is_published) {
    throw new ApiError(404, "Mock test not found.", "TEST_NOT_FOUND");
  }

  let hasPremiumEntitlement = false;
  let hasGrant = false;
  if (test.is_premium) {
    const [entitlement, grantResult] = await Promise.all([
      getUserEntitlement(userId),
      admin
        .from("test_access_grants")
        .select("id")
        .eq("user_id", userId)
        .eq("mock_test_id", sourceMockTestId)
        .maybeSingle(),
    ]);
    if (grantResult.error) throw grantResult.error;
    hasPremiumEntitlement = entitlement.isPaid &&
      isProductEntitled(entitlement.productType, "premium");
    hasGrant = Boolean(grantResult.data);
  }

  if (!canAccessLinkedMockTest({
    isPremium: test.is_premium,
    hasPremiumEntitlement,
    hasGrant,
  })) {
    throw new ApiError(403, "Premium access required.", "PREMIUM_REQUIRED");
  }

  return {
    maxAttempts: Math.max(0, Number(test.max_attempts ?? 0)),
    showSolutions: Boolean(test.show_solutions),
  };
}
