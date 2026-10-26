import { NextRequest } from "next/server";
import { ApiError, apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env.server";
import { verifyRazorpaySignature } from "@/lib/razorpay";
import { unlockTestForUser } from "@/lib/test-access";

type RazorpayPaymentEntity = {
  id?: unknown;
  order_id?: unknown;
  status?: unknown;
  amount?: unknown;
  currency?: unknown;
};

type RazorpayWebhookBody = {
  event?: unknown;
  payload?: { payment?: { entity?: RazorpayPaymentEntity } };
  payment_id?: unknown;
  order_id?: unknown;
  status?: unknown;
};

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function matchesPaymentAmount(payment: {
  amount: number | string | null;
  final_amount: number | string | null;
  currency: string | null;
}, entity: RazorpayPaymentEntity) {
  const providerAmount = Number(entity.amount);
  const expectedAmount = Number(payment.final_amount ?? payment.amount);
  const providerCurrency = asNonEmptyString(entity.currency)?.toUpperCase();
  const expectedCurrency = payment.currency?.toUpperCase();
  return Number.isSafeInteger(providerAmount)
    && Number.isFinite(expectedAmount)
    && providerAmount === Math.round(expectedAmount * 100)
    && Boolean(providerCurrency)
    && providerCurrency === expectedCurrency;
}

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

    const body = JSON.parse(rawBody) as RazorpayWebhookBody;
    const event = asNonEmptyString(body.event);
    if (event && !["payment.captured", "payment.failed"].includes(event)) {
      return apiSuccess({ received: true, ignored: true });
    }

    const entity = body.payload?.payment?.entity ?? {};
    const paymentId = asNonEmptyString(entity.id) ?? asNonEmptyString(body.payment_id);
    const orderId = asNonEmptyString(entity.order_id) ?? asNonEmptyString(body.order_id);
    const providerStatus = asNonEmptyString(entity.status) ?? asNonEmptyString(body.status);
    const eventStatus = event === "payment.captured" ? "captured" : event === "payment.failed" ? "failed" : providerStatus;

    if (!paymentId || !orderId || !eventStatus || !["captured", "failed"].includes(eventStatus)) {
      return apiError("Missing or invalid payment details", 400, "INVALID_WEBHOOK");
    }
    if (event && providerStatus !== eventStatus) {
      return apiError("Payment status does not match webhook event", 400, "INVALID_WEBHOOK");
    }

    const admin = createAdminClient();
    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .select("id, user_id, plan_id, status, amount, final_amount, currency, razorpay_payment_id, metadata")
      .eq("razorpay_order_id", orderId)
      .maybeSingle();

    if (paymentError) throw paymentError;
    if (!payment) return apiError("Payment record not found", 404, "PAYMENT_NOT_FOUND");

    if (eventStatus === "failed") {
      if (payment.status !== "pending") {
        return apiSuccess({ received: true, status: payment.status, duplicate: true });
      }

      const { error } = await admin
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
    }

    if (!matchesPaymentAmount(payment, entity)) {
      return apiError("Payment amount or currency does not match the order", 400, "PAYMENT_AMOUNT_MISMATCH");
    }

    if (payment.plan_id) {
      const { data, error } = await admin.rpc("fulfill_subscription_payment", {
        p_order_id: orderId,
        p_payment_id: paymentId,
      });
      if (error) throw error;
      const fulfillment = data as { already_fulfilled?: boolean } | null;
      return apiSuccess({
        received: true,
        status: "paid",
        duplicate: Boolean(fulfillment?.already_fulfilled),
      });
    }

    const metadata = payment.metadata && typeof payment.metadata === "object"
      ? payment.metadata as { test_id?: unknown }
      : null;
    const testId = asNonEmptyString(metadata?.test_id);
    if (!testId) {
      return apiError("Payment is not linked to a supported product", 409, "PAYMENT_PRODUCT_INVALID");
    }
    if (payment.status === "completed" && payment.razorpay_payment_id !== paymentId) {
      return apiError("Payment order was completed with a different payment", 409, "PAYMENT_ALREADY_COMPLETED");
    }
    if (payment.status !== "pending" && payment.status !== "completed") {
      return apiError("Payment order cannot be completed", 409, "PAYMENT_STATE_INVALID");
    }

    await unlockTestForUser(payment.user_id, testId);
    if (payment.status === "completed") {
      return apiSuccess({ received: true, status: "completed", duplicate: true });
    }

    const { data: updatedPayment, error: updateError } = await admin
      .from("payments")
      .update({
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updatedPayment) {
      const { data: latestPayment, error: latestError } = await admin
        .from("payments")
        .select("status, razorpay_payment_id")
        .eq("id", payment.id)
        .maybeSingle();
      if (latestError) throw latestError;
      if (latestPayment?.status === "completed" && latestPayment.razorpay_payment_id === paymentId) {
        return apiSuccess({ received: true, status: "completed", duplicate: true });
      }
      throw new ApiError(409, "Payment order changed while being fulfilled", "PAYMENT_STATE_CONFLICT");
    }

    return apiSuccess({ received: true, status: "completed" });
  } catch (error) {
    return handleApiError(error);
  }
}
