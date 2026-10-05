import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { serverEnv } from "@/lib/env.server";
import { unlockTestForUser } from "@/lib/test-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCapturedRazorpayPayment, isValidRazorpaySignature } from "@/lib/ebooks/payments";

const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  testId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) return apiError("Please sign in before verifying payment.", 401, "UNAUTHORIZED");

    try {
      requireVerifiedSession(session.profile, session.user, { allowRoles: ["student"] });
    } catch (error) {
      return apiError(error instanceof Error ? error.message : "Authentication required", 403, "FORBIDDEN");
    }

    const payload = await validateBody(verifyPaymentSchema, await request.json());

    if (!serverEnv.RAZORPAY_KEY_SECRET) {
      return apiError("Payments are not configured yet.", 503, "PAYMENTS_NOT_CONFIGURED");
    }

    const admin = createAdminClient();
    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .select("id, user_id, amount, currency, status, metadata")
      .eq("razorpay_order_id", payload.razorpay_order_id)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment || payment.user_id !== session.user.id || payment.status !== "pending") {
      return apiError("Payment order is invalid", 400, "PAYMENT_ORDER_INVALID");
    }
    if ((payment.metadata as { test_id?: string } | null)?.test_id !== payload.testId) {
      return apiError("Payment is not linked to this test", 400, "PAYMENT_TEST_MISMATCH");
    }

    const Razorpay = (await import("razorpay")).default;
    const razorpay = new Razorpay({ key_id: serverEnv.RAZORPAY_KEY_ID || "", key_secret: serverEnv.RAZORPAY_KEY_SECRET });
    const order = await razorpay.orders.fetch(payload.razorpay_order_id);
    if (order.currency !== payment.currency || Number(order.amount) !== Math.round(Number(payment.amount) * 100)) {
      return apiError("Payment amount mismatch", 400, "PAYMENT_AMOUNT_MISMATCH");
    }

    if (!isValidRazorpaySignature(payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature, serverEnv.RAZORPAY_KEY_SECRET)) {
      return apiSuccess({ success: false, message: "Payment verification failed." });
    }

    const providerPayment = await razorpay.payments.fetch(payload.razorpay_payment_id);
    if (!isCapturedRazorpayPayment(providerPayment, {
      paymentId: payload.razorpay_payment_id,
      orderId: payload.razorpay_order_id,
      amountMinor: Math.round(Number(payment.amount) * 100),
      currency: payment.currency,
    })) {
      return apiError("Payment has not been captured for the expected amount and currency.", 400, "PAYMENT_NOT_CAPTURED");
    }

    const unlock = await unlockTestForUser(session.user.id, payload.testId);
    const { error: updateError } = await admin.from("payments").update({
      razorpay_payment_id: payload.razorpay_payment_id,
      razorpay_signature: payload.razorpay_signature,
      status: "completed",
      updated_at: new Date().toISOString(),
    }).eq("id", payment.id).eq("status", "pending");
    if (updateError) throw updateError;
    return apiSuccess({ success: true, unlock });
  } catch (error) {
    return handleApiError(error);
  }
}