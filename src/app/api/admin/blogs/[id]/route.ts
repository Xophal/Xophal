import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, handleApiError, validateBody } from "@/lib/api-utils";

const blogPatchSchema = z.object({
  title: z.string().min(2).max(500).optional(),
  slug: z.string().min(2).max(500).optional(),
  excerpt: z.string().max(2000).optional().or(z.literal("")),
  content: z.string().max(200000).optional().or(z.literal("")),
  featured_image_url: z.string().url().optional().or(z.literal("")),
  tags: z.array(z.string().min(1).max(60)).optional(),
  is_published: z.boolean().optional(),
  meta_title: z.string().max(200).optional().or(z.literal("")),
  meta_description: z.string().max(500).optional().or(z.literal("")),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const payload = await validateBody(blogPatchSchema, await request.json());

    const row: Record<string, unknown> = { ...payload, updated_at: new Date().toISOString() };
    if (payload.excerpt === "") row.excerpt = null;
    if (payload.content === "") row.content = null;
    if (payload.featured_image_url === "") row.featured_image_url = null;
    if (payload.meta_title === "") row.meta_title = null;
    if (payload.meta_description === "") row.meta_description = null;
    if (payload.is_published === true) row.published_at = new Date().toISOString();

    const { data, error } = await createAdminClient().from("blogs").update(row).eq("id", id).select().maybeSingle();
    if (error) throw error;
    if (!data) return apiError("Blog not found", 404, "NOT_FOUND");
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const { error } = await createAdminClient().from("blogs").delete().eq("id", id);
    if (error) throw error;
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
