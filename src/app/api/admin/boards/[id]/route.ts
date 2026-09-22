import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const boardUpdateSchema = z.object({
  code: z.string().min(2).max(50).optional(),
  name: z.string().min(2).max(200).optional(),
  slug: z.string().min(2).max(200).optional(),
  description: z.string().max(1000).optional().or(z.literal("")),
  logo_url: z.string().url().optional().or(z.literal("")),
  website_url: z.string().url().optional().or(z.literal("")),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const payload = await validateBody(boardUpdateSchema, await request.json());
    const admin = createAdminClient();
    const { data, error } = await admin.from("boards").update({ ...payload, logo_url: payload.logo_url || null, website_url: payload.website_url || null, description: payload.description || null }).eq("id", id).select().maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Board not found", "NOT_FOUND");
    return apiSuccess(data);
  } catch (error) { return handleApiError(error); }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const admin = createAdminClient();
    const { data, error } = await admin.from("boards").update({ is_active: false }).eq("id", id).select().maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Board not found", "NOT_FOUND");
    return apiSuccess({ archived: true, board: data });
  } catch (error) { return handleApiError(error); }
}
