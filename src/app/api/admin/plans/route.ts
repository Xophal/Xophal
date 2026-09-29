import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const planSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional().or(z.literal("")),
  price: z.number().nonnegative(),
  currency: z.string().length(3).optional().default("INR"),
  duration_days: z.number().int().positive(),
  features: z.array(z.string().max(200)).optional().default([]),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

export async function GET() {
  try {
    await requireAdminAuth();
    const { data, error } = await createAdminClient()
      .from("subscription_plans")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return apiSuccess(data ?? []);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();
    const payload = await validateBody(planSchema, await request.json());
    const { data, error } = await createAdminClient()
      .from("subscription_plans")
      .insert([
        {
          ...payload,
          description: payload.description || null,
          features: payload.features,
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
