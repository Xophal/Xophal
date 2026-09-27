import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";

const createOrderSchema = z.object({
  testId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) return apiError("Please sign in before starting payment.", 401, "UNAUTHORIZED");

    const profile = session.profile;
    try {
      requireVerifiedSession(profile, session.user, { allowRoles: ["student"] });
    } catch (error) {
      return apiError(error instanceof Error ? error.message : "Authentication required", 403, "FORBIDDEN");
    }

    const payload = await validateBody(createOrderSchema, await request.json());
    const admin = createAdminClient();
    const { data: test } = await admin
      .from("mock_tests")
      .select("id, is_premium, is_published, is_active, access_price")
      .eq("id", payload.testId)
      .maybeSingle();
    if (!test || !test.is_active || !test.is_published) {
      return apiError("Test not found", 404, "TEST_NOT_FOUND");
    }
    if (!test.is_premium) {
      return apiError("This test does not require payment", 400, "PAYMENT_NOT_REQUIRED");
    }
    const amount = Number(test.access_price);
    if (!Number.isFinite(amount) || amount <= 0) {
      return apiError("This test is not configured for payment", 503, "PAYMENT_NOT_CONFIGURED");
    }

    if (!serverEnv.RAZORPAY_KEY_ID || !serverEnv.RAZORPAY_KEY_SECRET) {
      return apiError("Payments are not configured yet.", 503, "PAYMENTS_NOT_CONFIGURED");
    }

    const Razorpay = (await import("razorpay")).default;
    const razorpay = new Razorpay({ key_id: serverEnv.RAZORPAY_KEY_ID, key_secret: serverEnv.RAZORPAY_KEY_SECRET });
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `test_${session.user.id.slice(0, 8)}_${Date.now()}`,
      notes: { test_id: payload.testId, user_id: session.user.id },
    });

    const { error: paymentError } = await admin.from("payments").insert({
      user_id: session.user.id,
      amount,
      final_amount: amount,
      currency: "INR",
      razorpay_order_id: order.id,
      status: "pending",
      metadata: { test_id: payload.testId },
    });
    if (paymentError) throw paymentError;

    return apiSuccess({ order, keyId: serverEnv.RAZORPAY_KEY_ID, testId: payload.testId });
  } catch (error) {
    return handleApiError(error);
  }
}