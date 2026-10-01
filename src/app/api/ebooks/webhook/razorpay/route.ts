import { NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOrderByProviderOrderId, markEbookOrderFulfilled, markEbookOrderPaid, recordVerifiedEbookPaymentCosts, refundEbookOrder } from "@/lib/ebooks/orders";
import { isValidRazorpayWebhookSignature } from "@/lib/ebooks/payments";

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string; fee?: number | null; tax?: number | null } };
    refund?: { entity?: { id?: string; payment_id?: string; amount?: number } };
  };
};

/**
 * Signed provider callback. This is the authoritative confirmation that money
 * moved; the browser response is only a fast path. The signature is always
 * checked before any order state changes.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!serverEnv.RAZORPAY_WEBHOOK_SECRET) {
    return NextResponse.json({ success: false, error: "Webhook secret is not configured." }, { status: 503 });
  }
  if (!signature || !isValidRazorpayWebhookSignature(rawBody, signature, serverEnv.RAZORPAY_WEBHOOK_SECRET)) {
    return NextResponse.json({ success: false, error: "Invalid webhook signature." }, { status: 400 });
  }

  let body: RazorpayWebhookPayload;
  try {
    body = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid webhook body." }, { status: 400 });
  }

  const admin = createAdminClient();

  if (body.event === "payment.captured") {
    const payment = body.payload?.payment?.entity;
    if (payment?.order_id && payment.id) {
      const order = await findOrderByProviderOrderId(payment.order_id);
      // Only touch orders this marketplace created.
      if (
        order
        && order.provider === "razorpay"
        && order.currency.toUpperCase() === payment.currency?.toUpperCase()
        && Math.round(Number(order.gross_amount) * 100) === Number(payment.amount)
      ) {
        const { alreadyPaid } = await markEbookOrderPaid({
          orderId: order.id,
          providerTransactionId: payment.id,
        });
        if (payment.fee !== null && payment.fee !== undefined && payment.tax !== null && payment.tax !== undefined) {
          await recordVerifiedEbookPaymentCosts({
            orderId: order.id,
            paymentFee: Number(payment.fee) / 100,
            taxAmount: Number(payment.tax) / 100,
          });
        }
        await markEbookOrderFulfilled(order.id);
        if (!alreadyPaid) {
          await admin.from("ebook_events").insert({
            event_name: "ebook_purchase_completed",
            ebook_id: order.ebook_id,
            user_id: order.buyer_user_id,
            source: "provider_webhook",
            metadata: { order_id: order.id },
          });
        }
      }
    }
  }

  if (body.event === "refund.processed" || body.event === "refund.created") {
    const refund = body.payload?.refund?.entity;
    if (refund?.payment_id) {
      const { data: order } = await admin
        .from("ebook_transactions")
        .select("id")
        .eq("provider_transaction_id", refund.payment_id)
        .maybeSingle();
      if (order) await refundEbookOrder(order.id, `Provider refund ${refund.id ?? ""}`.trim());
    }
  }

  return NextResponse.json({ success: true });
}
