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
      payload?: { payment?: { entity?: { id?: string; order_id?: string; status?: string } } };
      payment_id?: string;
      order_id?: string;
      status?: string;
    };
    const supabase = createAdminClient();

    const paymentId = body?.payload?.payment?.entity?.id ?? body?.payment_id;
    const orderId = body?.payload?.payment?.entity?.order_id ?? body?.order_id;
    const status = body?.payload?.payment?.entity?.status ?? body?.status;

    if (!paymentId || !orderId) {
      return apiError("Missing payment identifiers", 400, "INVALID_WEBHOOK");
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("id, user_id, plan_id, status")
      .eq("razorpay_order_id", orderId)
      .maybeSingle();

    if (paymentError) throw paymentError;
    if (!payment) return apiError("Payment record not found", 404, "PAYMENT_NOT_FOUND");

    const nextStatus = status === "captured" ? "completed" : status === "failed" ? "failed" : "pending";

    if (body.event && !["payment.captured", "payment.failed"].includes(body.event)) {
      return apiSuccess({ received: true, ignored: true });
    }

    if (nextStatus === "completed" && (payment as { status?: string }).status === "completed") {
      return apiSuccess({ received: true, status: nextStatus, duplicate: true });
    }

    const { error } = await supabase
      .from("payments")
      .update({
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    if (error) throw error;

    if (nextStatus === "completed") {
      const { data: plan } = await supabase
        .from("subscription_plans")
        .select("duration_days")
        .eq("id", payment.plan_id)
        .maybeSingle();
      if (!plan) return apiError("Subscription plan not found", 404, "PLAN_NOT_FOUND");

      const startsAt = new Date();
      const expiresAt = new Date(startsAt.getTime() + Number(plan.duration_days) * 24 * 60 * 60 * 1000);
      const { data: existingSubscription } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", payment.user_id)
        .eq("plan_id", payment.plan_id)
        .eq("status", "active")
        .gt("expires_at", startsAt.toISOString())
        .limit(1)
        .maybeSingle();

      if (!existingSubscription) {
        const { error: subscriptionError } = await supabase.from("subscriptions").insert([{
          user_id: payment.user_id,
          plan_id: payment.plan_id,
          status: "active",
          starts_at: startsAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          auto_renew: false,
        }]);
        if (subscriptionError) throw subscriptionError;
      }
    }

    return apiSuccess({ received: true, status: nextStatus });
  } catch (error) {
    return handleApiError(error);
  }
}
