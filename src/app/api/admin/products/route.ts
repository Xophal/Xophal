import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateProductScope } from "@/lib/subscription-pricing";

const productSchema = z.object({
  code: z.string().min(3).max(80),
  product_type: z.enum(["free", "class_9_monthly", "class_10_season_pass"]),
  board_code: z.string().min(2).max(32).default("seba"),
  class_number: z.union([z.literal(9), z.literal(10)]),
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  price_paise: z.number().int().nonnegative().optional().default(0),
  early_bird_price_paise: z.number().int().nonnegative().nullable().optional(),
  school_price_paise: z.number().int().nonnegative().nullable().optional(),
  duration_days: z.number().int().positive().nullable().optional(),
  validity_starts_at: z.string().optional().nullable(),
  validity_ends_at: z.string().optional().nullable(),
  is_active: z.boolean().optional().default(true),
  is_public: z.boolean().optional().default(true),
  metadata: z.record(z.any()).optional().default({}),
});

export async function GET() {
  try {
    await requireAdminAuth();
    const { data, error } = await createAdminClient()
      .from("product_catalog")
      .select("*")
      .order("class_number", { ascending: true })
      .order("product_type", { ascending: true });

    if (error) throw error;
    return apiSuccess(data ?? []);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();
    const payload = await validateBody(productSchema, await request.json());
    const product = {
      ...payload,
      description: payload.description || null,
      metadata: payload.metadata ?? {},
    };

    if (!validateProductScope(product as any)) {
      return apiError("Product scope is not valid for the approved SEBA product model.", 400, "INVALID_PRODUCT_SCOPE");
    }

    const { data, error } = await createAdminClient()
      .from("product_catalog")
      .insert([product])
      .select()
      .single();

    if (error) throw error;
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
