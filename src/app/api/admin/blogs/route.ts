import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, apiSuccess, handleApiError, getPaginationParams, paginatedResponse, validateBody } from "@/lib/api-utils";
import { createBlogSlug } from "@/lib/blog-content";

const blogSchema = z.object({
  title: z.string().trim().min(2).max(500),
  slug: z.string().trim().max(500).optional().or(z.literal("")),
  excerpt: z.string().max(2000).optional().or(z.literal("")),
  content: z.string().max(200000).optional().or(z.literal("")),
  featured_image_url: z.string().url().optional().or(z.literal("")),
  tags: z.array(z.string().min(1).max(60)).optional().default([]),
  is_published: z.boolean().optional().default(false),
  meta_title: z.string().max(200).optional().or(z.literal("")),
  meta_description: z.string().max(500).optional().or(z.literal("")),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    const { searchParams } = request.nextUrl;
    const { page, limit, offset } = getPaginationParams(searchParams);
    const search = (searchParams.get("q") || "").trim();
    const published = searchParams.get("published");

    let query = createAdminClient()
      .from("blogs")
      .select("id, title, slug, excerpt, featured_image_url, tags, is_published, published_at, meta_title, meta_description, created_at, updated_at, profiles(full_name, email)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (search) query = query.or(`title.ilike.%${search}%,slug.ilike.%${search}%`);
    if (published === "true") query = query.eq("is_published", true);
    if (published === "false") query = query.eq("is_published", false);

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    return apiSuccess(paginatedResponse(data ?? [], count ?? 0, page, limit));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminAuth();
    const payload = await validateBody(blogSchema, await request.json());
    if (payload.is_published && !payload.content?.trim()) {
      throw new ApiError(400, "Add article content before publishing.", "BLOG_CONTENT_REQUIRED");
    }

    const row = {
      title: payload.title,
      slug: createBlogSlug(payload.slug || payload.title),
      excerpt: payload.excerpt || null,
      content: payload.content || null,
      featured_image_url: payload.featured_image_url || null,
      tags: payload.tags,
      is_published: payload.is_published,
      published_at: payload.is_published ? new Date().toISOString() : null,
      meta_title: payload.meta_title || null,
      meta_description: payload.meta_description || null,
      author_id: session.user.id,
    };

    const { data, error } = await createAdminClient().from("blogs").insert([row]).select().single();
    if (error?.code === "23505") throw new ApiError(409, "That article URL is already in use. Choose a different slug.", "SLUG_TAKEN");
    if (error) throw error;
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
