import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const subscriptionStatusSchema = z.object({
  status: z.enum(["active", "suspended", "cancelled"]),
  notes: z.string().trim().max(1000).optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    assertTrustedOrigin(request);
    const session = await requireAdminRole(["admin", "super_admin", "subscription_admin"]);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new ApiError(400, "A valid subscription ID is required.", "INVALID_SUBSCRIPTION_ID");
    }

    const payload = await validateBody(subscriptionStatusSchema, await request.json());
    const { data, error } = await createAdminClient().rpc("set_subscription_status", {
      p_subscription_id: id,
      p_actor_id: session.user.id,
      p_status: payload.status,
      p_notes: payload.notes ?? null,
    });
    if (error) {
      if (error.message.includes("not found")) throw new ApiError(404, "Subscription not found.", "SUBSCRIPTION_NOT_FOUND");
      if (error.message.includes("expired") || error.message.includes("cannot be changed") || error.message.includes("status transition")) {
        throw new ApiError(409, error.message, "SUBSCRIPTION_STATUS_CONFLICT");
      }
      throw error;
    }
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
