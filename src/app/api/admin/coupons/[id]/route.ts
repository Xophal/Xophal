import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, handleApiError, validateBody } from "@/lib/api-utils";

const couponPatchSchema = z.object({
  description: z.string().max(500).optional().or(z.literal("")),
  discount_type: z.enum(["percentage", "flat"]).optional(),
  discount_value: z.number().nonnegative().optional(),
  max_uses: z.number().int().nonnegative().optional(),
  min_order_amount: z.number().nonnegative().optional(),
  valid_until: z.string().optional().or(z.literal("")),
  is_active: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const payload = await validateBody(couponPatchSchema, await request.json());

    const row: Record<string, unknown> = { ...payload };
    if (payload.description === "") row.description = null;
    if (payload.valid_until === "") row.valid_until = null;

    const { data, error } = await createAdminClient().from("coupons").update(row).eq("id", id).select().maybeSingle();
    if (error) throw error;
    if (!data) return apiError("Coupon not found", 404, "NOT_FOUND");
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const { data, error } = await createAdminClient().from("coupons").update({ is_active: false }).eq("id", id).select().maybeSingle();
    if (error) throw error;
    if (!data) return apiError("Coupon not found", 404, "NOT_FOUND");
    return apiSuccess({ archived: true, coupon: data });
  } catch (error) {
    return handleApiError(error);
  }
}
