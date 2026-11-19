import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const refundSchema = z.object({
  orderId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  refundReference: z.string().trim().min(3).max(160),
  refundDate: z.string().datetime(),
  reason: z.string().trim().min(3).max(1000),
  status: z.enum(["pending", "confirmed", "rejected"]),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminRole(["admin", "super_admin", "refund_approver"]);
    const payload = await validateBody(refundSchema, await request.json());
    const admin = createAdminClient();
    const { data: order, error: orderError } = await admin
      .from("ebook_transactions")
      .select("id, gross_amount, status")
      .eq("id", payload.orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || !["VERIFIED", "REFUNDED"].includes(order.status)) {
      return apiError("Only verified ebook payments can be refunded.", 409, "NOT_REFUNDABLE");
    }

    const grossMinor = Math.round(Number(order.gross_amount) * 100);
    if (payload.amountMinor > grossMinor) return apiError("Refund amount exceeds the original payment.", 400, "REFUND_TOO_LARGE");

    if (payload.status === "confirmed") {
      const { data: confirmedRefunds, error: refundError } = await admin
        .from("refund_events")
        .select("amount_minor")
        .eq("order_id", payload.orderId)
        .eq("status", "confirmed");
      if (refundError) throw refundError;
      const alreadyRefunded = (confirmedRefunds ?? []).reduce((sum, row) => sum + Number(row.amount_minor), 0);
      if (alreadyRefunded + payload.amountMinor > grossMinor) {
        return apiError("Confirmed refunds would exceed the original payment.", 400, "REFUND_TOTAL_TOO_LARGE");
      }
    }

    const { data, error } = await admin.from("refund_events").insert({
      order_id: payload.orderId,
      amount_minor: payload.amountMinor,
      refund_reference: payload.refundReference,
      refund_date: payload.refundDate,
      reason: payload.reason,
      status: payload.status,
      admin_id: session.user.id,
    }).select("id, order_id, amount_minor, refund_reference, refund_date, reason, status, admin_id, created_at").single();
    if (error?.code === "23505") return apiError("This refund reference has already been recorded.", 409, "DUPLICATE_REFUND_REFERENCE");
    if (error) throw error;

    if (payload.status === "confirmed") {
      await admin.from("ebook_transactions").update({
        refund_status: payload.amountMinor === grossMinor ? "REFUNDED" : "PARTIAL",
        refunded_amount: payload.amountMinor / 100,
        refunded_at: payload.amountMinor === grossMinor ? payload.refundDate : null,
        status: payload.amountMinor === grossMinor ? "REFUNDED" : "VERIFIED",
        order_status: payload.amountMinor === grossMinor ? "REFUNDED" : "PAID",
        updated_at: new Date().toISOString(),
      }).eq("id", payload.orderId);
    }

    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
