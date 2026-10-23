import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const submissionPatchSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reason: z.string().max(1000).optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAdminRole(["payment_verifier", "subscription_admin"]);
    const { id } = await params;
    const payload = await validateBody(submissionPatchSchema, await request.json());
    const { data, error } = await createAdminClient().rpc("resolve_manual_payment_submission", {
      p_submission_id: id,
      p_actor_id: session.user.id,
      p_status: payload.status,
      p_reason: payload.reason ?? null,
    });

    if (error) {
      if (error.message.includes("Payment submission not found")) {
        return apiError("Payment submission not found", 404, "NOT_FOUND");
      }
      if (error.message.includes("already been reviewed")) {
        return apiError("This payment submission has already been reviewed.", 409, "SUBMISSION_ALREADY_REVIEWED");
      }
      if (error.message.includes("reference has already been approved")) {
        return apiError("This UPI transaction reference has already been approved.", 409, "DUPLICATE_PAYMENT_REFERENCE");
      }
      if (
        error.message.includes("season dates must be configured")
        || error.message.includes("season has already expired")
        || error.message.includes("purchase snapshot")
        || error.message.includes("subscription plan is not configured")
        || error.message.includes("subscription duration is invalid")
      ) {
        return apiError("This payment cannot be approved because its product configuration is invalid.", 409, "PRODUCT_CONFIGURATION_INVALID");
      }
      throw error;
    }
    if (!data) throw new Error("Payment submission review returned no result.");

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
