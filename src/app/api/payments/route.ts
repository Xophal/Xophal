import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { z } from "zod";
import { serverEnv } from "@/lib/env.server";
import { checkRateLimit } from "@/lib/rate-limit";

const createPaymentSchema = z.object({
  planId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    await checkRateLimit(request);

    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey || !z.string().uuid().safeParse(idempotencyKey).success) {
      return apiError("A valid idempotency key is required", 400, "INVALID_IDEMPOTENCY_KEY");
    }

    const payload = await validateBody(createPaymentSchema, await request.json());
    const session = await requireAuth();
    if (!session) {
      return apiError("Authentication required", 401, "UNAUTHORIZED");
    }

    try {
      requireVerifiedSession(session.profile, session.user, { allowRoles: ["student"] });
    } catch (error) {
      return apiError(error instanceof Error ? error.message : "Authentication required", 403, "FORBIDDEN");
    }

    const adminClient = createAdminClient();
    const { data: plan, error: planError } = await adminClient
      .from("subscription_plans")
      .select("id, name, price, currency, duration_days")
      .eq("id", payload.planId)
      .eq("is_active", true)
      .maybeSingle();

    if (planError) throw planError;
    if (!plan) return apiError("Plan not found", 404, "PLAN_NOT_FOUND");
    const price = Number(plan.price);
    const currency = String(plan.currency || "INR").toUpperCase();
    const amountMinor = Math.round(price * 100);
    if (!Number.isFinite(price) || price <= 0 || !Number.isSafeInteger(amountMinor) || currency !== "INR") {
      return apiError("This plan is not configured for payment", 503, "PAYMENT_NOT_CONFIGURED");
    }

    const { data: activeSubscription, error: subscriptionError } = await adminClient
      .from("subscriptions")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;
    if (activeSubscription) {
      return apiError("An active subscription already exists for this account", 409, "ACTIVE_SUBSCRIPTION_EXISTS");
    }

    const { data: existingPayment, error: existingPaymentError } = await adminClient
      .from("payments")
      .select("id, plan_id, amount, currency, status, razorpay_order_id")
      .eq("user_id", session.user.id)
      .eq("checkout_idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existingPaymentError) throw existingPaymentError;
    if (existingPayment) {
      if (existingPayment.plan_id !== plan.id) {
        return apiError("This checkout request was already used for another plan", 409, "IDEMPOTENCY_KEY_REUSED");
      }
      if (!existingPayment.razorpay_order_id) {
        return apiError("This checkout request is still being prepared. Start a new attempt if it does not complete.", 409, "ORDER_CREATION_IN_PROGRESS");
      }
      return apiSuccess({
        paymentId: existingPayment.id,
        keyId: serverEnv.RAZORPAY_KEY_ID,
        order: {
          id: existingPayment.razorpay_order_id,
          amount: Math.round(Number(existingPayment.amount) * 100),
          currency: existingPayment.currency,
        },
        plan: { name: plan.name, durationDays: plan.duration_days },
      });
    }

    if (!serverEnv.RAZORPAY_KEY_ID || !serverEnv.RAZORPAY_KEY_SECRET) {
      return apiError("Payments are not configured yet", 503, "PAYMENTS_NOT_CONFIGURED");
    }

    const payment = {
      user_id: session.user.id,
      plan_id: plan.id,
      amount: price,
      final_amount: price,
      currency,
      status: "pending",
      metadata: { source: "subscription_checkout" },
      checkout_idempotency_key: idempotencyKey,
    };

    const { data, error } = await adminClient
      .from("payments")
      .insert([payment])
      .select("id")
      .single();

    if (error?.code === "23505") {
      const { data: duplicateRow } = await adminClient
        .from("payments")
        .select("id, plan_id, amount, currency, status, razorpay_order_id")
        .eq("user_id", session.user.id)
        .eq("checkout_idempotency_key", idempotencyKey)
        .maybeSingle();

      const duplicate = duplicateRow as {
        id: string;
        plan_id: string;
        amount: number | string;
        currency: string;
        status: string;
        razorpay_order_id: string | null;
      } | null;

      if (duplicate && duplicate.plan_id === plan.id && duplicate.razorpay_order_id) {
        const duplicateOrderId = duplicate.razorpay_order_id;
        return apiSuccess({
          paymentId: duplicate.id,
          keyId: serverEnv.RAZORPAY_KEY_ID,
          order: { id: duplicateOrderId, amount: amountMinor, currency: duplicate.currency },
          plan: { name: plan.name, durationDays: plan.duration_days },
        });
      }
      return apiError("This checkout request is already being processed", 409, "ORDER_CREATION_IN_PROGRESS");
    }
    if (error) throw error;

    const Razorpay = (await import("razorpay")).default;
    const razorpay = new Razorpay({ key_id: serverEnv.RAZORPAY_KEY_ID, key_secret: serverEnv.RAZORPAY_KEY_SECRET });
    let order;
    try {
      order = await razorpay.orders.create({
        amount: amountMinor,
        currency,
        receipt: `xophol_${data.id.replaceAll("-", "")}`,
        notes: { plan_id: plan.id, user_id: session.user.id },
      });
    } catch (error) {
      await adminClient.from("payments").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", data.id);
      throw error;
    }

    const { data: linkedPayment, error: linkError } = await adminClient
      .from("payments")
      .update({ razorpay_order_id: order.id, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("status", "pending")
      .is("razorpay_order_id", null)
      .select("id")
      .maybeSingle();
    if (linkError) throw linkError;
    if (!linkedPayment) return apiError("Unable to link the payment order. Contact support before retrying.", 503, "ORDER_LINK_FAILED");

    return apiSuccess({
      paymentId: data.id,
      keyId: serverEnv.RAZORPAY_KEY_ID,
      order: { id: order.id, amount: amountMinor, currency },
      plan: { name: plan.name, durationDays: plan.duration_days },
    }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") {
      return apiError("Too many requests", 429, "RATE_LIMIT");
    }
    return handleApiError(error);
  }
}
