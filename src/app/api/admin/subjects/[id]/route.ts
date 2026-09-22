import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const subjectUpdateSchema = z.object({
  class_id: z.string().uuid().optional(),
  code: z.string().min(2).max(50).optional(),
  name: z.string().min(2).max(200).optional(),
  slug: z.string().min(2).max(200).optional(),
  description: z.string().max(1000).optional().or(z.literal("")),
  color: z.string().max(30).optional().or(z.literal("")),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const payload = await validateBody(subjectUpdateSchema, await request.json());
    const admin = createAdminClient();
    if (payload.class_id) {
      const { data: classRow } = await admin.from("classes").select("id").eq("id", payload.class_id).eq("is_active", true).maybeSingle();
      if (!classRow) throw new ApiError(400, "Class is not available", "INVALID_CLASS");
    }
    const { data, error } = await admin.from("subjects").update({ ...payload, description: payload.description || null, color: payload.color || null }).eq("id", id).select().maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Subject not found", "NOT_FOUND");
    return apiSuccess(data);
  } catch (error) { return handleApiError(error); }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const admin = createAdminClient();
    const { data, error } = await admin.from("subjects").update({ is_active: false }).eq("id", id).select().maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Subject not found", "NOT_FOUND");
    return apiSuccess({ archived: true, subject: data });
  } catch (error) { return handleApiError(error); }
}
