import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CACHE_KEYS, CACHE_TTL } from "@/constants";
import { getCached, setCache } from "@/lib/redis";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Topic } from "@/types";

export async function GET(request: NextRequest) {
  try {
    await checkRateLimit(request);

    const chapterId = request.nextUrl.searchParams.get("chapterId");
    if (!chapterId) return apiError("chapterId is required", 400, "MISSING_PARAM");

    const supabase = await createClient();
    const { data: activeChapter } = await supabase
      .from("chapters")
      .select("id, subjects!inner(is_active, classes!inner(is_active, boards!inner(is_active)))")
      .eq("id", chapterId)
      .eq("is_active", true)
      .eq("subjects.is_active", true)
      .eq("subjects.classes.is_active", true)
      .eq("subjects.classes.boards.is_active", true)
      .maybeSingle();
    if (!activeChapter) return apiError("Chapter not found", 404, "NOT_FOUND");

    const cacheKey = CACHE_KEYS.TOPICS(chapterId);
    const cached = await getCached<Topic[]>(cacheKey);
    if (cached) return apiSuccess(cached);

    const { data, error } = await supabase
      .from("topics")
      .select("id, chapter_id, code, name, slug, description, is_active, sort_order")
      .eq("chapter_id", chapterId)
      .eq("is_active", true)
      .order("sort_order");

    if (error) throw error;

    await setCache(cacheKey, data, CACHE_TTL.MEDIUM);
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") {
      return apiError("Too many requests", 429, "RATE_LIMIT");
    }
    return handleApiError(error);
  }
}
