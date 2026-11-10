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

    let body: {
      event?: string;
      payload?: {
        payment?: { entity?: { id?: string; order_id?: string; status?: string; amount?: number; currency?: string } };
        refund?: { entity?: { id?: string; payment_id?: string; amount?: number } };
      };
    };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return apiError("Invalid webhook body", 400, "INVALID_WEBHOOK");
    }

    if (["refund.created", "refund.processed", "refund.failed"].includes(body.event ?? "")) {
      const refund = body.payload?.refund?.entity;
      if (!refund?.id || !refund.payment_id) {
        return apiError("Missing refund identifiers", 400, "INVALID_WEBHOOK");
      }

      const admin = createAdminClient();
      const { data: payment, error: paymentError } = await admin
        .from("payments")
        .select("id, final_amount, amount")
        .eq("razorpay_payment_id", refund.payment_id)
        .maybeSingle();
      if (paymentError) throw paymentError;
      if (!payment) return apiSuccess({ received: true, ignored: true });

      if (body.event === "refund.created") {
        const { error } = await admin.rpc("attach_razorpay_payment_refund", {
          p_payment_id: payment.id,
          p_refund_id: refund.id,
        });
        if (error) throw error;
        return apiSuccess({ received: true, status: "refund_pending" });
      }

      if (body.event === "refund.failed") {
        const { data, error } = await admin.rpc("fail_razorpay_payment_refund", {
          p_payment_id: payment.id,
          p_refund_id: refund.id,
        });
        if (error) throw error;
        return apiSuccess({ received: true, ...(data as Record<string, unknown>) });
      }

      if (!Number.isSafeInteger(refund.amount)) {
        return apiError("Refund is missing its amount", 400, "INVALID_WEBHOOK");
      }
      const expectedAmountMinor = Math.round(Number(payment.final_amount ?? payment.amount) * 100);
      if (refund.amount !== expectedAmountMinor) {
        const { error } = await admin.rpc("attach_razorpay_payment_refund", {
          p_payment_id: payment.id,
          p_refund_id: refund.id,
        });
        if (error) throw error;
        return apiSuccess({ received: true, ignored: true, reason: "A full refund has not been confirmed" });
      }

      const { data, error } = await admin.rpc("complete_razorpay_payment_refund", {
        p_payment_id: payment.id,
        p_refund_id: refund.id,
        p_amount_minor: refund.amount,
        p_actor_id: null,
      });
      if (error) throw error;
      return apiSuccess({ received: true, ...(data as Record<string, unknown>) });
    }

    if (!["payment.captured", "payment.failed"].includes(body.event ?? "")) {
      return apiSuccess({ received: true, ignored: true });
    }

    const payment = body.payload?.payment?.entity;
    if (!payment?.id || !payment.order_id || !payment.status) {
      return apiError("Missing payment identifiers", 400, "INVALID_WEBHOOK");
    }

    const captured = body.event === "payment.captured";
    if ((captured && payment.status !== "captured") || (!captured && payment.status !== "failed")) {
      return apiError("Webhook event does not match the payment status", 400, "PAYMENT_STATUS_MISMATCH");
    }

    if (captured && (!Number.isSafeInteger(payment.amount) || !payment.currency)) {
      return apiError("Captured payment is missing amount or currency", 400, "INVALID_WEBHOOK");
    }

    const { data, error } = await createAdminClient().rpc("finalize_razorpay_payment", {
      p_order_id: payment.order_id,
      p_payment_id: payment.id,
      p_amount_minor: captured ? payment.amount! : 0,
      p_currency: captured ? payment.currency! : "INR",
      p_event: body.event!,
    });
    if (error) throw error;

    return apiSuccess({ received: true, ...(data as Record<string, unknown>) });
  } catch (error) {
    return handleApiError(error);
  }
}
