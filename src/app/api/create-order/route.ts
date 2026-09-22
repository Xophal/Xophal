import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { serverEnv } from "@/lib/env.server";

const createOrderSchema = z.object({
  amount: z.number().positive().finite(),
  testId: z.string().min(1).max(200),
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

    if (!serverEnv.RAZORPAY_KEY_ID || !serverEnv.RAZORPAY_KEY_SECRET) {
      return apiError("Payments are not configured yet.", 503, "PAYMENTS_NOT_CONFIGURED");
    }

    const Razorpay = (await import("razorpay")).default;
    const razorpay = new Razorpay({ key_id: serverEnv.RAZORPAY_KEY_ID, key_secret: serverEnv.RAZORPAY_KEY_SECRET });
    const order = await razorpay.orders.create({
      amount: Math.round(payload.amount * 100),
      currency: "INR",
      receipt: `test_${session.user.id.slice(0, 8)}_${Date.now()}`,
      notes: { test_id: payload.testId, user_id: session.user.id },
    });

    return apiSuccess({ order, keyId: serverEnv.RAZORPAY_KEY_ID, testId: payload.testId });
  } catch (error) {
    return handleApiError(error);
  }
}