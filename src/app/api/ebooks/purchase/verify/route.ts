import { NextRequest } from "next/server";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { serverEnv } from "@/lib/env.server";
import { isEbookPaymentsEnabled } from "@/lib/ebooks/payments";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOrderByProviderOrderId, markEbookOrderFulfilled, markEbookOrderPaid, recordVerifiedEbookPaymentCosts } from "@/lib/ebooks/orders";
import { isCapturedRazorpayPayment, isValidRazorpaySignature } from "@/lib/ebooks/payments";
import { ebookPurchaseVerificationSchema } from "@/lib/ebooks/schema";

/**
 * Server-side confirmation of an eBook purchase. The order is only finalised
 * when the provider signature matches AND the provider reports the expected
 * amount and currency. Idempotent: replaying a verified response is safe.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isEbookPaymentsEnabled(serverEnv.EBOOK_PAYMENTS_ENABLED)) {
      throw new ApiError(503, "Marketplace payments are coming soon.", "PAYMENTS_DISABLED");
    }
    assertTrustedOrigin(request);
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Please sign in before verifying payment.", "UNAUTHORIZED");
    requireVerifiedSession(session.profile, session.user, {});

    const payload = await validateBody(ebookPurchaseVerificationSchema, await request.json());
    if (!serverEnv.RAZORPAY_KEY_SECRET) {
      throw new ApiError(503, "In-platform checkout is not enabled yet.", "PAYMENTS_NOT_CONFIGURED");
    }

    const order = await findOrderByProviderOrderId(payload.razorpay_order_id);
    if (!order || order.buyer_user_id !== session.user.id || order.ebook_id !== payload.ebookId) {
      throw new ApiError(400, "Payment order is invalid.", "PAYMENT_ORDER_INVALID");
    }

    const accessUrl = `/api/ebooks/${order.ebook_id}/external`;
    if (order.status === "VERIFIED") {
      return apiSuccess({ success: true, alreadyVerified: true, orderNumber: order.order_number, accessUrl });
    }

    const Razorpay = (await import("razorpay")).default;
    const razorpay = new Razorpay({ key_id: serverEnv.RAZORPAY_KEY_ID || "", key_secret: serverEnv.RAZORPAY_KEY_SECRET });
    const providerOrder = await razorpay.orders.fetch(payload.razorpay_order_id);
    const expectedMinor = Math.round(Number(order.gross_amount) * 100);
    if (providerOrder.currency !== order.currency || Number(providerOrder.amount) !== expectedMinor) {
      throw new ApiError(400, "Payment amount mismatch.", "PAYMENT_AMOUNT_MISMATCH");
    }

    if (!isValidRazorpaySignature(payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature, serverEnv.RAZORPAY_KEY_SECRET)) {
      return apiSuccess({ success: false, message: "Payment verification failed." });
    }

    const providerPayment = await razorpay.payments.fetch(payload.razorpay_payment_id);
    if (!isCapturedRazorpayPayment(providerPayment, {
      paymentId: payload.razorpay_payment_id,
      orderId: payload.razorpay_order_id,
      amountMinor: expectedMinor,
      currency: order.currency,
    })) {
      throw new ApiError(400, "Payment has not been captured for the expected amount and currency.", "PAYMENT_NOT_CAPTURED");
    }

    const { order: paid, alreadyPaid } = await markEbookOrderPaid({
      orderId: order.id,
      providerTransactionId: payload.razorpay_payment_id,
      providerSignature: payload.razorpay_signature,
    });
    if (!paid) throw new ApiError(500, "Payment could not be recorded.", "ORDER_UPDATE_FAILED");

    if (providerPayment.fee !== null && providerPayment.fee !== undefined
      && providerPayment.tax !== null && providerPayment.tax !== undefined) {
      await recordVerifiedEbookPaymentCosts({
        orderId: order.id,
        paymentFee: Number(providerPayment.fee) / 100,
        taxAmount: Number(providerPayment.tax) / 100,
      });
    }

    if (!alreadyPaid) {
      await markEbookOrderFulfilled(order.id);
      await createAdminClient().from("ebook_events").insert({
        event_name: "ebook_purchase_completed",
        ebook_id: order.ebook_id,
        user_id: session.user.id,
        source: "checkout_verify",
        metadata: { order_id: order.id },
      });
    }

    return apiSuccess({ success: true, orderNumber: paid.order_number, accessUrl });
  } catch (error) {
    return handleApiError(error);
  }
}
