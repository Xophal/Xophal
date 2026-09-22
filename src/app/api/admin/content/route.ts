import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateBody, apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { z } from "zod";

const schema = z.object({
  id: z.string().optional(),
  type: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  content: z.string().min(1),
  status: z.string().optional(),
  topicId: z.string().uuid().optional(),
  chapterId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();
    const body = await request.json();
    const payload = await validateBody(schema, body);

    const admin = createAdminClient();
    const type = (payload.type || "blog").toLowerCase();

    if (type === "lesson" || type === "lessons") {
      if (!payload.topicId) return apiError("topicId is required for lessons", 400, "MISSING_TOPIC_ID");
      const { data, error } = await admin.from("lessons").insert([
        {
          topic_id: payload.topicId,
          title: payload.title,
          slug: payload.slug || payload.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
          content: payload.content,
          content_html: null,
          is_active: payload.status?.toLowerCase() !== "archived",
          created_by: (await requireAdminAuth()).user.id,
        },
      ]).select().maybeSingle();

      if (error) throw error;
      return apiSuccess({ record: data });
    }

    if (type === "note" || type === "notes") {
      const { data, error } = await admin.from("notes").insert([{
        topic_id: payload.topicId || null,
        chapter_id: payload.chapterId || null,
        title: payload.title,
        slug: payload.slug || payload.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        content: payload.content,
        is_active: payload.status?.toLowerCase() !== "archived",
        created_by: (await requireAdminAuth()).user.id,
      }]).select().maybeSingle();
      if (error) throw error;
      return apiSuccess({ record: data });
    }

    const { user } = await requireAdminAuth();
    const { data, error } = await admin.from("blogs").insert([
      {
        title: payload.title,
        slug: payload.slug || payload.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        excerpt: payload.excerpt ?? null,
        content: payload.content,
        is_published: payload.status?.toLowerCase?.() === "published",
        author_id: user.id,
      },
    ]).select().maybeSingle();

    if (error) throw error;
    return apiSuccess({ record: data });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdminAuth();
    const body = await request.json();
    const payload = await validateBody(schema, body);
    if (!payload.id) return apiError("id is required for update", 400, "MISSING_ID");

    const admin = createAdminClient();
    const type = (payload.type || "blog").toLowerCase();

    if (type === "lesson" || type === "lessons") {
      if (!payload.topicId) return apiError("topicId is required for lessons", 400, "MISSING_TOPIC_ID");
      const { data, error } = await admin.from("lessons").update({
        topic_id: payload.topicId,
        title: payload.title,
        slug: payload.slug || payload.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        content: payload.content,
        is_active: payload.status?.toLowerCase() !== "archived",
      }).eq("id", payload.id).select().maybeSingle();

      if (error) throw error;
      return apiSuccess({ record: data });
    }

    const { data, error } = await admin.from("blogs").update({
      title: payload.title,
      slug: payload.slug || payload.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      excerpt: payload.excerpt ?? null,
      content: payload.content,
      is_published: payload.status?.toLowerCase?.() === "published",
    }).eq("id", payload.id).select().maybeSingle();

    if (error) throw error;
    return apiSuccess({ record: data });
  } catch (err) {
    return handleApiError(err);
  }
}
