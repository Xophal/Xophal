import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const chapterUpdateSchema = z.object({
  subject_id: z.string().uuid().optional(),
  code: z.string().min(2).max(50).optional(),
  name: z.string().min(2).max(300).optional(),
  slug: z.string().min(2).max(300).optional(),
  description: z.string().max(2000).optional().or(z.literal("")),
  chapter_number: z.number().int().positive().nullable().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const payload = await validateBody(chapterUpdateSchema, await request.json());
    const admin = createAdminClient();
    const { data, error } = await admin.from("chapters").update({
      ...payload,
      description: payload.description || null,
    }).eq("id", id).select().maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Chapter not found", "NOT_FOUND");
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const admin = createAdminClient();
    const { data, error } = await admin.from("chapters").update({ is_active: false }).eq("id", id).select().maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Chapter not found", "NOT_FOUND");
    return apiSuccess({ archived: true, chapter: data });
  } catch (error) {
    return handleApiError(error);
  }
}
