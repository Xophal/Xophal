import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const classUpdateSchema = z.object({
  board_id: z.string().uuid().optional(),
  code: z.string().min(2).max(50).optional(),
  name: z.string().min(2).max(200).optional(),
  slug: z.string().min(2).max(200).optional(),
  description: z.string().max(1000).optional().or(z.literal("")),
  grade_number: z.number().int().min(1).max(12).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const payload = await validateBody(classUpdateSchema, await request.json());
    const admin = createAdminClient();
    if (payload.board_id) {
      const { data: board } = await admin.from("boards").select("id").eq("id", payload.board_id).eq("is_active", true).maybeSingle();
      if (!board) throw new ApiError(400, "Board is not available", "INVALID_BOARD");
    }
    const { data, error } = await admin.from("classes").update({ ...payload, description: payload.description || null }).eq("id", id).select().maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Class not found", "NOT_FOUND");
    return apiSuccess(data);
  } catch (error) { return handleApiError(error); }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const admin = createAdminClient();
    const { data, error } = await admin.from("classes").update({ is_active: false }).eq("id", id).select().maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Class not found", "NOT_FOUND");
    return apiSuccess({ archived: true, class: data });
  } catch (error) { return handleApiError(error); }
}
