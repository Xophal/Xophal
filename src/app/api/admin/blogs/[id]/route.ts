import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, apiSuccess, apiError, handleApiError, validateBody } from "@/lib/api-utils";
import { createBlogSlug } from "@/lib/blog-content";

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

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const { data, error } = await createAdminClient().from("blogs").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return apiError("Blog not found", 404, "NOT_FOUND");
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const payload = await validateBody(blogPatchSchema, await request.json());

    const row: Record<string, unknown> = { ...payload, updated_at: new Date().toISOString() };
    if (payload.slug !== undefined) {
      const slugSource = payload.slug.trim() || payload.title;
      if (slugSource) row.slug = createBlogSlug(slugSource);
      else delete row.slug;
    }
    if (payload.excerpt === "") row.excerpt = null;
    if (payload.content === "") row.content = null;
    if (payload.featured_image_url === "") row.featured_image_url = null;
    if (payload.meta_title === "") row.meta_title = null;
    if (payload.meta_description === "") row.meta_description = null;
    if (payload.is_published === true) {
      const { data: existing, error: lookupError } = await createAdminClient()
        .from("blogs")
        .select("is_published, published_at, content")
        .eq("id", id)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!existing) return apiError("Blog not found", 404, "NOT_FOUND");
      if (!(payload.content ?? existing.content)?.trim()) {
        throw new ApiError(400, "Add article content before publishing.", "BLOG_CONTENT_REQUIRED");
      }
      row.published_at = existing.is_published && existing.published_at
        ? existing.published_at
        : new Date().toISOString();
    }
    if (payload.is_published === false) row.published_at = null;

    const { data, error } = await createAdminClient().from("blogs").update(row).eq("id", id).select().maybeSingle();
    if (error?.code === "23505") throw new ApiError(409, "That article URL is already in use. Choose a different slug.", "SLUG_TAKEN");
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
