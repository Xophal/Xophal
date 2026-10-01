import { NextRequest } from "next/server";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { ebookPayoutOnboardingSchema } from "@/lib/ebooks/schema";
import { createRazorpayRouteAccount, fetchRazorpayRouteAccount, isRazorpayRouteConfigured, RazorpayRouteError } from "@/lib/ebooks/razorpay-route";

export async function GET() {
  try {
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required.", "UNAUTHORIZED");
    if (!isRazorpayRouteConfigured()) return apiSuccess({ enabled: false, account: null });

    const { data, error } = await createAdminClient()
      .from("ebook_seller_payout_accounts")
      .select("provider_account_id, account_status, activation_status, settlement_verification_status, settlement_account_last4")
      .eq("seller_user_id", session.user.id)
      .maybeSingle();
    if (error) throw error;

    let account = data;
    if (data?.provider_account_id) {
      try {
        const latest = await fetchRazorpayRouteAccount(data.provider_account_id);
        await createAdminClient().rpc("refresh_ebook_route_account_status", {
          p_provider_account_id: data.provider_account_id,
          p_account_status: latest.accountStatus,
          p_activation_status: latest.activationStatus,
          p_settlement_verification_status: latest.settlementVerificationStatus,
        });
        account = { ...data, ...latest };
      } catch (refreshError) {
        if (!(refreshError instanceof RazorpayRouteError)) throw refreshError;
        account = data;
      }
    }

    return apiSuccess({
      enabled: isRazorpayRouteConfigured(),
      account: account ? {
        account_status: account.account_status,
        activation_status: account.activation_status,
        settlement_verification_status: account.settlement_verification_status,
        settlement_account_last4: account.settlement_account_last4,
      } : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    await checkRateLimit(request);
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required.", "UNAUTHORIZED");
    requireVerifiedSession(session.profile, session.user, {});
    if (!isRazorpayRouteConfigured()) {
      throw new ApiError(503, "Seller payout onboarding is not enabled yet.", "PAYOUTS_NOT_CONFIGURED");
    }
    if (!session.user.email) throw new ApiError(400, "Add and verify an email address before payout onboarding.", "EMAIL_REQUIRED");

    const input = await validateBody(ebookPayoutOnboardingSchema, await request.json());
    const admin = createAdminClient();
    const { data: existing, error: readError } = await admin
      .from("ebook_seller_payout_accounts")
      .select("provider_account_id")
      .eq("seller_user_id", session.user.id)
      .maybeSingle();
    if (readError) throw readError;
    if (existing?.provider_account_id) {
      throw new ApiError(409, "A Razorpay payout account is already linked to this seller.", "PAYOUT_ACCOUNT_EXISTS");
    }

    const { data: onboardingKey, error: reserveError } = await admin.rpc("reserve_ebook_route_onboarding", {
      p_seller_user_id: session.user.id,
    });
    if (reserveError) throw reserveError;
    if (!onboardingKey) throw new ApiError(409, "Payout onboarding is already in progress. Retry shortly.", "PAYOUT_ONBOARDING_IN_PROGRESS");

    try {
      const account = await createRazorpayRouteAccount({
        sellerUserId: session.user.id,
        idempotencyKey: onboardingKey,
        legalBusinessName: input.legalBusinessName,
        businessType: input.businessType,
        pan: input.pan,
        gst: input.gst || undefined,
        email: session.user.email,
        phone: input.phone,
        settlementAccount: input.settlementAccount,
      });

      const { error: saveError } = await admin.rpc("save_ebook_route_account", {
        p_seller_user_id: session.user.id,
        p_onboarding_key: onboardingKey,
        p_provider_account_id: account.providerAccountId,
        p_account_status: account.accountStatus,
        p_activation_status: account.activationStatus,
        p_settlement_verification_status: account.settlementVerificationStatus,
        p_settlement_account_last4: account.settlementAccountLast4,
      });
      if (saveError) throw saveError;

      return apiSuccess({ account: {
        accountStatus: account.accountStatus,
        activationStatus: account.activationStatus,
        settlementVerificationStatus: account.settlementVerificationStatus,
        settlementAccountLast4: account.settlementAccountLast4,
      } }, 201);
    } catch (error) {
      if (error instanceof RazorpayRouteError) {
        if (error.status >= 400 && error.status < 500 && error.status !== 409) {
          await admin.rpc("rotate_ebook_route_onboarding_key", {
            p_seller_user_id: session.user.id,
            p_old_key: onboardingKey,
          });
        }
        throw new ApiError(error.status >= 500 ? 503 : 400, error.message, "PAYOUT_ONBOARDING_FAILED");
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") {
      return Response.json({ success: false, error: "Too many requests.", code: "RATE_LIMIT" }, { status: 429 });
    }
    return handleApiError(error);
  }
}