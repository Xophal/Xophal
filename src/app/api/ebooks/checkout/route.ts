import { NextRequest } from "next/server";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { checkRateLimit } from "@/lib/rate-limit";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMarketplaceConfig } from "@/lib/ebooks/config";
import { createPendingEbookOrder, hasVerifiedEbookPurchase, loadPurchasableEbook } from "@/lib/ebooks/orders";
import { isRazorpayRouteConfigured } from "@/lib/ebooks/razorpay-route";
import { ebookCheckoutSchema } from "@/lib/ebooks/schema";

/**
 * Starts a marketplace order for a paid eBook.
 *
 * The order row is created as PENDING. It only becomes VERIFIED once the
 * provider's signature is checked server-side in /api/ebooks/purchase/verify or
 * via the signed webhook. The browser can never mark an order paid.
 */
export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    await checkRateLimit(request);

    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Please sign in before buying this eBook.", "UNAUTHORIZED");
    requireVerifiedSession(session.profile, session.user, {});

    const { ebookId } = await validateBody(ebookCheckoutSchema, await request.json());
    const ebook = await loadPurchasableEbook(ebookId);
    if (!ebook) throw new ApiError(404, "eBook not found.", "NOT_FOUND");
    if (ebook.user_id === session.user.id) {
      throw new ApiError(400, "You cannot buy your own listing.", "SELF_PURCHASE");
    }
    if (Number(ebook.price) <= 0) {
      throw new ApiError(400, "This eBook is free to access.", "PAYMENT_NOT_REQUIRED");
    }
    if (!isRazorpayRouteConfigured() || ebook.currency.toUpperCase() !== "INR") {
      throw new ApiError(503, "Paid marketplace checkout is not available for this seller yet.", "SELLER_PAYOUT_NOT_READY");
    }
    if (await hasVerifiedEbookPurchase(session.user.id, ebook.id)) {
      throw new ApiError(409, "You already own this eBook.", "ALREADY_PURCHASED");
    }

    const { data: payoutAccount, error: payoutAccountError } = await createAdminClient()
      .from("ebook_seller_payout_accounts")
      .select("activation_status, settlement_verification_status")
      .eq("seller_user_id", ebook.user_id)
      .maybeSingle();
    if (payoutAccountError) throw payoutAccountError;
    if (payoutAccount?.activation_status !== "activated" || payoutAccount.settlement_verification_status !== "verified") {
      throw new ApiError(503, "This seller is completing payout verification. Please try again later.", "SELLER_PAYOUT_NOT_READY");
    }
    if (!serverEnv.RAZORPAY_KEY_ID || !serverEnv.RAZORPAY_KEY_SECRET) {
      throw new ApiError(503, "In-platform checkout is not enabled yet.", "PAYMENTS_NOT_CONFIGURED");
    }

    const config = await getMarketplaceConfig();
    const Razorpay = (await import("razorpay")).default;
    const razorpay = new Razorpay({ key_id: serverEnv.RAZORPAY_KEY_ID, key_secret: serverEnv.RAZORPAY_KEY_SECRET });

    const providerOrder = await razorpay.orders.create({
      amount: Math.round(Number(ebook.price) * 100),
      currency: (ebook.currency || "INR").toUpperCase(),
      receipt: `ebook_${session.user.id.slice(0, 8)}_${Date.now()}`,
      notes: { ebook_id: ebook.id, buyer_id: session.user.id, seller_id: ebook.user_id },
    });

    const order = await createPendingEbookOrder({
      ebook,
      buyerUserId: session.user.id,
      providerOrderId: providerOrder.id,
      config,
      provider: "razorpay",
    });

    await createAdminClient().from("ebook_events").insert({
      event_name: "ebook_purchase_started",
      ebook_id: ebook.id,
      user_id: session.user.id,
      source: "checkout",
      metadata: { order_id: order.id },
    });

    return apiSuccess({ orderId: order.id, orderNumber: order.order_number, providerOrder, keyId: serverEnv.RAZORPAY_KEY_ID }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") {
      return new Response(JSON.stringify({ success: false, error: "Too many requests.", code: "RATE_LIMIT" }), {
        status: 429,
        headers: { "content-type": "application/json" },
      });
    }
    return handleApiError(error);
  }
}
