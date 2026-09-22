import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const noteSchema = z.object({
  title: z.string().min(2).max(500),
  slug: z.string().min(2).max(500),
  content: z.string().min(5),
  chapter_id: z.string().uuid().optional().or(z.literal("")),
  topic_id: z.string().uuid().optional().or(z.literal("")),
  is_active: z.boolean().optional().default(true),
  is_premium: z.boolean().optional().default(false),
  sort_order: z.number().int().optional().default(0),
});

export async function GET() {
  try {
    await requireAdminAuth();
    const adminClient = createAdminClient();
    const { data, error } = await adminClient.from("notes").select("*").order("created_at", { ascending: false });
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
    const payload = await validateBody(noteSchema, body);
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("notes")
      .insert([
        {
          title: payload.title,
          slug: payload.slug,
          content: payload.content,
          chapter_id: payload.chapter_id || null,
          topic_id: payload.topic_id || null,
          is_active: payload.is_active,
          is_premium: payload.is_premium,
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
