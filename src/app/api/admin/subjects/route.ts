import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const subjectSchema = z.object({
  class_id: z.string().uuid(),
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(200),
  description: z.string().optional().or(z.literal("")),
  color: z.string().optional().or(z.literal("")),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const adminClient = createAdminClient();
    let query = adminClient.from("subjects").select("*").order("sort_order", { ascending: true });

    if (classId) {
      query = query.eq("class_id", classId);
    }

    const { data, error } = await query;
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
    const payload = await validateBody(subjectSchema, body);
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("subjects")
      .insert([
        {
          class_id: payload.class_id,
          code: payload.code,
          name: payload.name,
          slug: payload.slug,
          description: payload.description || null,
          color: payload.color || null,
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
