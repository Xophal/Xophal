import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { requireVerifiedSession } from "@/lib/auth-policy";
import { serverEnv } from "@/lib/env.server";
import { unlockTestForUser } from "@/lib/test-access";

const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  testId: z.string().min(1).max(200),
});

function isValidSignature(orderId: string, paymentId: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signature, "utf8");
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

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

    if (!isValidSignature(payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature, serverEnv.RAZORPAY_KEY_SECRET)) {
      return apiSuccess({ success: false, message: "Payment verification failed." });
    }

    const unlock = await unlockTestForUser(session.user.id, payload.testId);
    return apiSuccess({ success: true, unlock });
  } catch (error) {
    return handleApiError(error);
  }
}