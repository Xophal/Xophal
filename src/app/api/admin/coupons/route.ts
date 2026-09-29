import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError, getPaginationParams, paginatedResponse, validateBody } from "@/lib/api-utils";

const couponSchema = z.object({
  code: z.string().min(3).max(50),
  description: z.string().max(500).optional().or(z.literal("")),
  discount_type: z.enum(["percentage", "flat"]),
  discount_value: z.number().nonnegative(),
  max_uses: z.number().int().nonnegative().optional().default(0),
  min_order_amount: z.number().nonnegative().optional().default(0),
  valid_from: z.string().optional().or(z.literal("")),
  valid_until: z.string().optional().or(z.literal("")),
  is_active: z.boolean().optional().default(true),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    const { searchParams } = request.nextUrl;
    const { page, limit, offset } = getPaginationParams(searchParams);
    const search = (searchParams.get("q") || "").trim();

    let query = createAdminClient()
      .from("coupons")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });
    if (search) query = query.or(`code.ilike.%${search}%,description.ilike.%${search}%`);

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;
    return apiSuccess(paginatedResponse(data ?? [], count ?? 0, page, limit));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();
    const payload = await validateBody(couponSchema, await request.json());

    const { data, error } = await createAdminClient()
      .from("coupons")
      .insert([
        {
          code: payload.code.toUpperCase(),
          description: payload.description || null,
          discount_type: payload.discount_type,
          discount_value: payload.discount_value,
          max_uses: payload.max_uses,
          used_count: 0,
          min_order_amount: payload.min_order_amount,
          valid_from: payload.valid_from || new Date().toISOString(),
          valid_until: payload.valid_until || null,
          is_active: payload.is_active,
        },
      ])
      .select()
      .single();
    if (error) throw error;
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
