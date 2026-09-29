import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, handleApiError, validateBody } from "@/lib/api-utils";

const paymentPatchSchema = z.object({
  status: z.enum(["pending", "created", "paid", "failed", "refunded", "cancelled"]),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const payload = await validateBody(paymentPatchSchema, await request.json());
    const { data, error } = await createAdminClient()
      .from("payments")
      .update({ status: payload.status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return apiError("Payment not found", 404, "NOT_FOUND");
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
