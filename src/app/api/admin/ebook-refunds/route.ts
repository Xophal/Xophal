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
    if (payload.status === "confirmed" && order.status !== "VERIFIED") {
      return apiError("Only verified ebook payments can be refunded.", 409, "NOT_REFUNDABLE");
    }

    const { data, error } = await admin.rpc("record_manual_ebook_refund", {
      p_order_id: payload.orderId,
      p_amount_minor: payload.amountMinor,
      p_refund_reference: payload.refundReference,
      p_refund_date: payload.refundDate,
      p_reason: payload.reason,
      p_status: payload.status,
      p_admin_id: session.user.id,
    });
    if (error?.code === "23505") return apiError("This refund reference has already been recorded.", 409, "DUPLICATE_REFUND_REFERENCE");
    if (error?.message.includes("Confirmed refunds would exceed")) {
      return apiError("Confirmed refunds would exceed the original payment.", 400, "REFUND_TOTAL_TOO_LARGE");
    }
    if (error) throw error;

    return apiSuccess(data, data?.already_recorded ? 200 : 201);
  } catch (error) {
    return handleApiError(error);
  }
}
