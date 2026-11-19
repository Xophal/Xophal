import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const refundSchema = z.object({
  refund_id: z.string().uuid().optional().nullable(),
  amount_minor: z.number().int().positive(),
  status: z.enum(["pending", "verified", "rejected"]),
  refund_reference: z.string().trim().min(3).max(160).optional().nullable(),
  refund_date: z.string().datetime({ offset: true }).optional().nullable(),
  reason: z.string().trim().min(3).max(1000),
  revoke_access: z.boolean().default(true),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    assertTrustedOrigin(request);
    const session = await requireAdminRole(["admin", "super_admin", "refund_approver"]);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new ApiError(400, "A valid subscription ID is required.", "INVALID_SUBSCRIPTION_ID");
    }

    const payload = await validateBody(refundSchema, await request.json());
    if (payload.status === "verified" && (!payload.refund_reference || !payload.refund_date)) {
      throw new ApiError(400, "A verified refund requires the actual refund reference and date.", "REFUND_VERIFICATION_DETAILS_REQUIRED");
    }

    const { data, error } = await createAdminClient().rpc("save_subscription_refund", {
      p_refund_id: payload.refund_id ?? null,
      p_subscription_id: id,
      p_actor_id: session.user.id,
      p_amount_minor: payload.amount_minor,
      p_status: payload.status,
      p_refund_reference: payload.refund_reference ?? null,
      p_refund_date: payload.refund_date ?? null,
      p_reason: payload.reason,
      p_revoke_access: payload.revoke_access,
    });
    if (error) {
      if (
        error.message.includes("already been recorded") ||
        error.message.includes("exceed") ||
        error.message.includes("no verified payment") ||
        error.message.includes("not found") ||
        error.message.includes("does not belong")
      ) {
        throw new ApiError(409, error.message, "REFUND_CONFLICT");
      }
      if (error.message.includes("Only a pending refund")) {
        throw new ApiError(409, error.message, "REFUND_ALREADY_RESOLVED");
      }
      throw error;
    }
    return apiSuccess(data, payload.refund_id ? 200 : 201);
  } catch (error) {
    return handleApiError(error);
  }
}
