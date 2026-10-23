import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateProductScope } from "@/lib/subscription-pricing";

const productPatchSchema = z.object({
  code: z.string().min(3).max(80).optional(),
  product_type: z.enum(["free", "premium", "pro", "class_9_monthly", "class_10_season_pass"]).optional(),
  board_code: z.string().min(2).max(32).optional(),
  class_number: z.union([z.literal(9), z.literal(10)]).optional(),
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional().or(z.literal("")),
  price_paise: z.number().int().nonnegative().optional(),
  early_bird_price_paise: z.number().int().nonnegative().nullable().optional(),
  school_price_paise: z.number().int().nonnegative().nullable().optional(),
  duration_days: z.number().int().positive().nullable().optional(),
  validity_starts_at: z.string().optional().nullable(),
  validity_ends_at: z.string().optional().nullable(),
  early_bird_starts_at: z.string().optional().nullable(),
  early_bird_ends_at: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  is_public: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    await requireAdminRole(["super_admin", "admin", "subscription_admin"]);
    const { id } = await params;
    const { data, error } = await createAdminClient()
      .from("product_catalog")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return apiError("Product not found", 404, "PRODUCT_NOT_FOUND");
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireAdminRole(["super_admin", "admin", "subscription_admin"]);
    const { id } = await params;
    const payload = await validateBody(productPatchSchema, await request.json());
    const row: Record<string, unknown> = { ...payload, updated_at: new Date().toISOString() };
    if (payload.description === "") row.description = null;

    const existing = await createAdminClient()
      .from("product_catalog")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (existing.error) throw existing.error;
    if (!existing.data) return apiError("Product not found", 404, "PRODUCT_NOT_FOUND");

    const nextProduct = { ...existing.data, ...row };
    if (!validateProductScope(nextProduct as any)) {
      return apiError("Updated product scope is not valid for the approved SEBA product model.", 400, "INVALID_PRODUCT_SCOPE");
    }

    const { data, error } = await createAdminClient()
      .from("product_catalog")
      .update(row)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return apiError("Product not found", 404, "PRODUCT_NOT_FOUND");
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
