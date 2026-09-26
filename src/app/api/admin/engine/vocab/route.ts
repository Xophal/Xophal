import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { ENGINE_STATUSES, ENGINE_TYPES } from "@/lib/engine/vocab";

/**
 * GET /api/admin/engine/vocab — dropdown data for the engine question UI:
 * topics (with chapter/subject path), subtopics, engine types, statuses.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    const admin = createAdminClient();
    const topicSearch = (request.nextUrl.searchParams.get("topicSearch") ?? "").trim();

    let topicQuery = admin
      .from("topics")
      .select("id,code,name,slug,chapter_id,chapters(id,code,name,subjects(id,code,name))")
      .order("name", { ascending: true })
      .limit(200);
    if (topicSearch) topicQuery = topicQuery.ilike("name", `%${topicSearch}%`);
    const { data: topics, error: topicErr } = await topicQuery;
    if (topicErr) throw topicErr;

    const { data: subtopics, error: subErr } = await admin
      .from("subtopics")
      .select("id,code,name,slug,topic_id")
      .order("sort_order", { ascending: true })
      .limit(500);
    if (subErr) throw subErr;

    const { data: counts, error: countErr } = await admin.from("question_review_counts").select("*");
    if (countErr && (countErr as { code?: string }).code !== "42P01") throw countErr;

    const reviewCounts: Record<string, number> = {};
    for (const s of ENGINE_STATUSES) reviewCounts[s] = 0;
    for (const row of (counts ?? []) as Array<{ status: string; count: number | string }>) {
      reviewCounts[String(row.status)] = Number(row.count) || 0;
    }
    return apiSuccess({
      topics: topics ?? [],
      subtopics: subtopics ?? [],
      types: [...ENGINE_TYPES],
      statuses: [...ENGINE_STATUSES],
      reviewCounts,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** GET /api/admin/engine/vocab/subtopics?topicId= — subtopics for one topic. */
export async function POST(request: NextRequest) {
  try {
    await requireAdminAuth();
    const body = (await request.json()) as { topicId?: unknown };
    if (typeof body.topicId !== "string" || !body.topicId) {
      throw new ApiError(400, "topicId is required.", "VALIDATION_ERROR");
    }
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("subtopics")
      .select("id,code,name,slug,topic_id")
      .eq("topic_id", body.topicId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return apiSuccess(data ?? []);
  } catch (error) {
    return handleApiError(error);
  }
}
