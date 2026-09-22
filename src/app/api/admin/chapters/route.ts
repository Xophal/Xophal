import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const chapterSchema = z.object({
  subject_id: z.string().uuid(),
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(300),
  slug: z.string().min(2).max(300),
  description: z.string().optional().or(z.literal("")),
  chapter_number: z.number().int().positive().optional(),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    const subjectId = request.nextUrl.searchParams.get("subjectId");
    const admin = createAdminClient();
    let query = admin.from("chapters").select("*").order("sort_order", { ascending: true });
    if (subjectId) query = query.eq("subject_id", subjectId);
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
    const payload = await validateBody(chapterSchema, await request.json());
    const admin = createAdminClient();
    const { data, error } = await admin.from("chapters").insert([{
      ...payload,
      description: payload.description || null,
      chapter_number: payload.chapter_number ?? null,
    }]).select().single();
    if (error) throw error;
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
