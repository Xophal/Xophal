import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { serverEnv } from "@/lib/env.server";

const paymentPatchSchema = z.object({
  status: z.literal("refunded"),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    assertTrustedOrigin(request);
    const session = await requireAdminRole(["super_admin", "admin", "refund_approver"]);
    const { id } = await params;
    await validateBody(paymentPatchSchema, await request.json());
    const admin = createAdminClient();
    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .select("id, status, amount, final_amount, currency, razorpay_payment_id, razorpay_refund_id")
      .eq("id", id)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment) return apiError("Payment not found", 404, "NOT_FOUND");

    if (payment.status === "refunded") {
      return apiSuccess({ id: payment.id, status: "refunded", refundId: payment.razorpay_refund_id });
    }
    if (payment.status === "refund_pending") {
      return apiSuccess({ id: payment.id, status: "refund_pending", refundId: payment.razorpay_refund_id }, 202);
    }
    if (!["paid", "completed"].includes(payment.status) || !payment.razorpay_payment_id) {
      return apiError("Only a captured provider payment can be refunded here.", 409, "PAYMENT_NOT_REFUNDABLE");
    }
    if (!serverEnv.RAZORPAY_KEY_ID || !serverEnv.RAZORPAY_KEY_SECRET) {
      return apiError("Razorpay refunds are not configured.", 503, "PAYMENTS_NOT_CONFIGURED");
    }

    const { data: beginResult, error: beginError } = await admin.rpc("begin_razorpay_payment_refund", {
      p_payment_id: payment.id,
    });
    if (beginError) throw beginError;
    const beginStatus = (beginResult as { status?: string } | null)?.status;
    if (beginStatus === "refunded") {
      return apiSuccess({ id: payment.id, status: "refunded" });
    }
    if (beginStatus !== "started") {
      return apiSuccess({
        id: payment.id,
        status: "refund_pending",
        refundId: (beginResult as { refund_id?: string | null } | null)?.refund_id ?? null,
      }, 202);
    }

    const Razorpay = (await import("razorpay")).default;
    const razorpay = new Razorpay({ key_id: serverEnv.RAZORPAY_KEY_ID, key_secret: serverEnv.RAZORPAY_KEY_SECRET });
    const refund = await razorpay.payments.refund(payment.razorpay_payment_id, {
      notes: { app_payment_id: payment.id, requested_by: session.user.id },
    });
    if (!refund.id || !["processed", "pending"].includes(refund.status)) {
      return apiError("Razorpay returned an unrecognized refund status. Check the provider dashboard before retrying.", 502, "REFUND_STATUS_UNKNOWN");
    }

    if (refund.status === "pending") {
      const { error: attachError } = await admin.rpc("attach_razorpay_payment_refund", {
        p_payment_id: payment.id,
        p_refund_id: refund.id,
      });
      if (attachError) throw attachError;
      return apiSuccess({ id: payment.id, status: "refund_pending", refundId: refund.id }, 202);
    }

    const { error: attachError } = await admin.rpc("attach_razorpay_payment_refund", {
      p_payment_id: payment.id,
      p_refund_id: refund.id,
    });
    if (attachError) throw attachError;

    const expectedAmountMinor = Math.round(Number(payment.final_amount ?? payment.amount) * 100);
    if (Number(refund.amount) !== expectedAmountMinor) {
      return apiError("Razorpay did not confirm a full refund. Access has not been revoked.", 409, "FULL_REFUND_NOT_CONFIRMED");
    }
    const { data, error } = await admin.rpc("complete_razorpay_payment_refund", {
      p_payment_id: payment.id,
      p_refund_id: refund.id,
      p_amount_minor: Number(refund.amount),
      p_actor_id: session.user.id,
    });
    if (error) throw error;
    return apiSuccess({ id: payment.id, ...(data as Record<string, unknown>) });
  } catch (error) {
    return handleApiError(error);
  }
}
