import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env.server";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    if (!serverEnv.RAZORPAY_WEBHOOK_SECRET) {
      return apiError("Webhook is not configured", 503, "WEBHOOK_NOT_CONFIGURED");
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");
    if (!verifyRazorpaySignature(rawBody, signature, serverEnv.RAZORPAY_WEBHOOK_SECRET)) {
      return apiError("Invalid webhook signature", 401, "INVALID_WEBHOOK_SIGNATURE");
    }

    const body = JSON.parse(rawBody) as {
      event?: string;
      payload?: { payment?: { entity?: { id?: string; order_id?: string; status?: string; amount?: number; currency?: string } } };
      payment_id?: string;
      order_id?: string;
      status?: string;
    };
    const supabase = createAdminClient();

    if (body.event && !["payment.captured", "payment.failed"].includes(body.event)) {
      return apiSuccess({ received: true, ignored: true });
    }

    const entity = body.payload?.payment?.entity;
    const paymentId = entity?.id ?? body.payment_id;
    const orderId = entity?.order_id ?? body.order_id;
    const status = entity?.status ?? body.status;

    if (!paymentId || !orderId) {
      return apiError("Missing payment identifiers", 400, "INVALID_WEBHOOK");
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("id, final_amount, currency, status")
      .eq("razorpay_order_id", orderId)
      .maybeSingle();

    if (paymentError) throw paymentError;
    if (!payment) return apiError("Payment record not found", 404, "PAYMENT_NOT_FOUND");

    if ((body.event === "payment.captured" && status !== "captured")
      || (body.event === "payment.failed" && status !== "failed")) {
      return apiError("Webhook event does not match the payment status", 400, "INVALID_WEBHOOK");
    }

    if (status === "captured") {
      if (entity?.amount === undefined || !entity.currency
        || Number(entity.amount) !== Math.round(Number(payment.final_amount) * 100)
        || entity.currency.toUpperCase() !== String(payment.currency).toUpperCase()) {
        return apiError("Payment amount or currency does not match the order", 400, "PAYMENT_AMOUNT_MISMATCH");
      }

      const { data, error } = await supabase.rpc("fulfill_subscription_payment", {
        p_order_id: orderId,
        p_payment_id: paymentId,
      });
      if (error) throw error;
      return apiSuccess({ received: true, status: "paid", fulfillment: data });
    }

    if (status !== "failed") return apiSuccess({ received: true, ignored: true });

    const { error } = await supabase
      .from("payments")
      .update({
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .eq("status", "pending");
    if (error) throw error;

    return apiSuccess({ received: true, status: "failed" });
  } catch (error) {
    return handleApiError(error);
  }
}
