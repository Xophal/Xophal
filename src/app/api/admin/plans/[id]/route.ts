import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, handleApiError, validateBody } from "@/lib/api-utils";

const planPatchSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(1000).optional().or(z.literal("")),
  price: z.number().nonnegative().optional(),
  duration_days: z.number().int().positive().optional(),
  features: z.array(z.string().max(200)).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const payload = await validateBody(planPatchSchema, await request.json());

    const row: Record<string, unknown> = { ...payload, updated_at: new Date().toISOString() };
    if (payload.description === "") row.description = null;

    const { data, error } = await createAdminClient().from("subscription_plans").update(row).eq("id", id).select().maybeSingle();
    if (error) throw error;
    if (!data) return apiError("Plan not found", 404, "NOT_FOUND");
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
