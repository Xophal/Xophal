import { NextRequest } from "next/server";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { checkRateLimit } from "@/lib/rate-limit";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMarketplaceConfig } from "@/lib/ebooks/config";
import { recordVerifiedEbookPaymentCosts, releaseDueEbookBalances } from "@/lib/ebooks/orders";
import { createRazorpayRouteTransfer, isRazorpayRouteConfigured, RazorpayRouteError } from "@/lib/ebooks/razorpay-route";

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    await checkRateLimit(request);
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required.", "UNAUTHORIZED");
    requireVerifiedSession(session.profile, session.user, {});
    if (!isRazorpayRouteConfigured()) {
      throw new ApiError(503, "Seller payouts are not enabled yet.", "PAYOUTS_NOT_CONFIGURED");
    }

    const admin = createAdminClient();
    const config = await getMarketplaceConfig();
    await releaseDueEbookBalances(config.payoutHoldDays);

    const { data: uncostedOrders, error: uncostedError } = await admin
      .from("ebook_transactions")
      .select("id, provider_transaction_id")
      .eq("seller_user_id", session.user.id)
      .eq("provider", "razorpay")
      .eq("status", "VERIFIED")
      .is("seller_net_amount", null)
      .in("payout_status", ["PENDING", "AVAILABLE"])
      .limit(10);
    if (uncostedError) throw uncostedError;

    if (uncostedOrders?.length) {
      const Razorpay = (await import("razorpay")).default;
      const razorpay = new Razorpay({
        key_id: serverEnv.RAZORPAY_KEY_ID || "",
        key_secret: serverEnv.RAZORPAY_KEY_SECRET || "",
      });
      await Promise.all(uncostedOrders.map(async (order) => {
        if (!order.provider_transaction_id) return;
        const payment = await razorpay.payments.fetch(order.provider_transaction_id);
        if (payment.status === "captured" && payment.fee != null && payment.tax != null) {
          await recordVerifiedEbookPaymentCosts({
            orderId: order.id,
            paymentFee: Number(payment.fee) / 100,
            taxAmount: Number(payment.tax) / 100,
          });
        }
      }));
    }

    const { data, error } = await admin.rpc("claim_ebook_payout", { p_seller_user_id: session.user.id });
    if (error) throw error;
    const payout = data?.[0];
    if (!payout) {
      throw new ApiError(409, "No reconciled balance is currently eligible for payout.", "NO_PAYOUT_AVAILABLE");
    }

    let transfer;
    try {
      transfer = await createRazorpayRouteTransfer({
        accountId: payout.provider_account_id,
        amountMinor: Math.round(Number(payout.amount) * 100),
        payoutId: payout.payout_id,
      });
    } catch (error) {
      if (error instanceof RazorpayRouteError) {
        if (error.status >= 400 && error.status < 500 && error.status !== 409) {
          await admin.rpc("finalize_ebook_payout", {
            p_payout_id: payout.payout_id,
            p_provider_reference: null,
            p_provider_status: "failed",
            p_failure_reason: `Provider rejected the payout request (${error.status}).`,
          });
        }
        throw new ApiError(error.status >= 500 ? 503 : 400, error.message, "PAYOUT_PROVIDER_ERROR");
      }
      throw error;
    }

    const { error: finalizeError } = await admin.rpc("finalize_ebook_payout", {
      p_payout_id: payout.payout_id,
      p_provider_reference: transfer.transferId,
      p_provider_status: transfer.status,
      p_provider_fee: transfer.fee,
      p_provider_tax: transfer.tax,
      p_failure_reason: transfer.failureReason,
    });
    if (finalizeError) throw finalizeError;
    if (transfer.status === "failed") {
      throw new ApiError(502, "The provider could not process this payout. The balance is available for retry.", "PAYOUT_FAILED");
    }

      return apiSuccess(
        {
          payoutId: payout.payout_id,
          amount: Number(payout.amount),
          currency: payout.currency,
          status: transfer.status === "processed" ? "TRANSFERRED" : "PROCESSING",
          providerReference: transfer.transferId,
          providerFee: transfer.fee,
          providerTax: transfer.tax,
        },
        202
      );
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") {
      return Response.json({ success: false, error: "Too many requests.", code: "RATE_LIMIT" }, { status: 429 });
    }
    return handleApiError(error);
  }
}