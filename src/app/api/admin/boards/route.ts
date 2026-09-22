import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const boardSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(200),
  description: z.string().optional().or(z.literal("")),
  logo_url: z.string().url().optional().or(z.literal("")),
  website_url: z.string().url().optional().or(z.literal("")),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

export async function GET() {
  try {
    await requireAdminAuth();
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("boards")
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
    const body = await request.json();
    const payload = await validateBody(boardSchema, body);
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("boards")
      .insert([
        {
          code: payload.code,
          name: payload.name,
          slug: payload.slug,
          description: payload.description || null,
          logo_url: payload.logo_url || null,
          website_url: payload.website_url || null,
          is_active: payload.is_active,
          sort_order: payload.sort_order,
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
