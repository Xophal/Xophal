import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const topicSchema = z.object({
  chapter_id: z.string().uuid(),
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(300),
  slug: z.string().min(2).max(300),
  description: z.string().optional().or(z.literal("")),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    const chapterId = request.nextUrl.searchParams.get("chapterId");
    const admin = createAdminClient();
    let query = admin.from("topics").select("*").order("sort_order", { ascending: true });
    if (chapterId) query = query.eq("chapter_id", chapterId);
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
    const payload = await validateBody(topicSchema, await request.json());
    const admin = createAdminClient();
    const { data, error } = await admin.from("topics").insert([{
      ...payload,
      description: payload.description || null,
    }]).select().single();
    if (error) throw error;
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
