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

function createSlug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function contentListItem(type: string, row: { id: string; title: string; created_at: string; updated_at?: string; is_active?: boolean; is_published?: boolean }) {
  const published = row.is_published ?? row.is_active ?? false;
  return {
    id: row.id,
    type,
    title: row.title,
    status: published ? "published" : "draft",
    created_at: row.created_at,
    updated_at: row.updated_at,
    createdAt: row.created_at,
  };
}

export async function GET() {
  try {
    await requireAdminAuth();
    const admin = createAdminClient();
    const [blogs, lessons, notes, announcements] = await Promise.all([
      admin.from("blogs").select("id, title, is_published, created_at, updated_at").order("created_at", { ascending: false }).limit(20),
      admin.from("lessons").select("id, title, is_active, created_at, updated_at").order("created_at", { ascending: false }).limit(20),
      admin.from("notes").select("id, title, is_active, created_at, updated_at").order("created_at", { ascending: false }).limit(20),
      admin.from("announcements").select("id, title, is_active, created_at").order("created_at", { ascending: false }).limit(20),
    ]);

    for (const result of [blogs, lessons, notes, announcements]) {
      if (result.error) throw result.error;
    }

    const items = [
      ...(blogs.data ?? []).map((row) => contentListItem("blog", row)),
      ...(lessons.data ?? []).map((row) => contentListItem("lesson", row)),
      ...(notes.data ?? []).map((row) => contentListItem("note", row)),
      ...(announcements.data ?? []).map((row) => contentListItem("announcement", row)),
    ]
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
      .slice(0, 20);

    return apiSuccess(items);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAdminAuth();
    const body = await request.json();
    const payload = await validateBody(schema, body);

    const type = payload.type.trim().toLowerCase();
    const slug = payload.slug || createSlug(payload.title);
    if (!["blog", "lesson", "lessons", "note", "notes", "announcement", "announcements"].includes(type)) {
      return apiError("Unsupported content type.", 400, "UNSUPPORTED_CONTENT_TYPE");
    }
    const admin = createAdminClient();

    if (type === "lesson" || type === "lessons") {
      if (!payload.topicId) return apiError("topicId is required for lessons", 400, "MISSING_TOPIC_ID");
      const { data, error } = await admin.from("lessons").insert([
        {
          topic_id: payload.topicId,
          title: payload.title,
          slug,
          content: payload.content,
          content_html: null,
          is_active: payload.status?.toLowerCase() === "published",
          created_by: user.id,
        },
      ]).select().maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Lesson was not returned after insert.");
      return apiSuccess({ record: contentListItem("lesson", data) }, 201);
    }

    if (type === "note" || type === "notes") {
      const { data, error } = await admin.from("notes").insert([{
        topic_id: payload.topicId || null,
        chapter_id: payload.chapterId || null,
        title: payload.title,
        slug,
        content: payload.content,
        is_active: payload.status?.toLowerCase() === "published",
        created_by: user.id,
      }]).select().maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Note was not returned after insert.");
      return apiSuccess({ record: contentListItem("note", data) }, 201);
    }

    if (type === "announcement" || type === "announcements") {
      const { data, error } = await admin.from("announcements").insert([{
        title: payload.title,
        content: payload.content,
        is_active: payload.status?.toLowerCase() === "published",
        created_by: user.id,
      }]).select().maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Announcement was not returned after insert.");
      return apiSuccess({ record: contentListItem("announcement", data) }, 201);
    }

    const { data, error } = await admin.from("blogs").insert([
      {
        title: payload.title,
        slug,
        excerpt: payload.excerpt ?? null,
        content: payload.content,
        is_published: payload.status?.toLowerCase() === "published",
        published_at: payload.status?.toLowerCase() === "published" ? new Date().toISOString() : null,
        author_id: user.id,
      },
    ]).select().maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Blog was not returned after insert.");
    return apiSuccess({ record: contentListItem("blog", data) }, 201);
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

    const type = payload.type.trim().toLowerCase();
    const slug = payload.slug || createSlug(payload.title);
    if (!["blog", "lesson", "lessons", "note", "notes", "announcement", "announcements"].includes(type)) {
      return apiError("Unsupported content type.", 400, "UNSUPPORTED_CONTENT_TYPE");
    }
    const admin = createAdminClient();

    if (type === "lesson" || type === "lessons") {
      if (!payload.topicId) return apiError("topicId is required for lessons", 400, "MISSING_TOPIC_ID");
      const { data, error } = await admin.from("lessons").update({
        topic_id: payload.topicId,
        title: payload.title,
        slug,
        content: payload.content,
        is_active: payload.status?.toLowerCase() === "published",
      }).eq("id", payload.id).select().maybeSingle();

      if (error) throw error;
      if (!data) return apiError("Lesson not found.", 404, "NOT_FOUND");
      return apiSuccess({ record: data });
    }

    if (type === "note" || type === "notes") {
      const { data, error } = await admin.from("notes").update({
        topic_id: payload.topicId || null,
        chapter_id: payload.chapterId || null,
        title: payload.title,
        slug,
        content: payload.content,
        is_active: payload.status?.toLowerCase() === "published",
      }).eq("id", payload.id).select().maybeSingle();

      if (error) throw error;
      if (!data) return apiError("Note not found.", 404, "NOT_FOUND");
      return apiSuccess({ record: data });
    }

    if (type === "announcement" || type === "announcements") {
      const { data, error } = await admin.from("announcements").update({
        title: payload.title,
        content: payload.content,
        is_active: payload.status?.toLowerCase() === "published",
      }).eq("id", payload.id).select().maybeSingle();

      if (error) throw error;
      if (!data) return apiError("Announcement not found.", 404, "NOT_FOUND");
      return apiSuccess({ record: data });
    }

    const { data, error } = await admin.from("blogs").update({
      title: payload.title,
      slug,
      excerpt: payload.excerpt ?? null,
      content: payload.content,
      is_published: payload.status?.toLowerCase() === "published",
      published_at: payload.status?.toLowerCase() === "published" ? new Date().toISOString() : null,
    }).eq("id", payload.id).select().maybeSingle();

    if (error) throw error;
    if (!data) return apiError("Blog not found.", 404, "NOT_FOUND");
    return apiSuccess({ record: data });
  } catch (err) {
    return handleApiError(err);
  }
}
