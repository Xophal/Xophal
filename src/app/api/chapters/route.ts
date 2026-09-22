import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CACHE_KEYS, CACHE_TTL } from "@/constants";
import { getCached, setCache } from "@/lib/redis";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Chapter } from "@/types";

export async function GET(request: NextRequest) {
  try {
    await checkRateLimit(request);

    const subjectId = request.nextUrl.searchParams.get("subjectId");
    if (!subjectId) return apiError("subjectId is required", 400, "MISSING_PARAM");

    const supabase = await createClient();
    const { data: activeSubject } = await supabase
      .from("subjects")
      .select("id, classes!inner(is_active, boards!inner(is_active))")
      .eq("id", subjectId)
      .eq("is_active", true)
      .eq("classes.is_active", true)
      .eq("classes.boards.is_active", true)
      .maybeSingle();
    if (!activeSubject) return apiError("Subject not found", 404, "NOT_FOUND");

    const cacheKey = CACHE_KEYS.CHAPTERS(subjectId);
    const cached = await getCached<Chapter[]>(cacheKey);
    if (cached) return apiSuccess(cached);

    const { data, error } = await supabase
      .from("chapters")
      .select("id, subject_id, code, name, slug, chapter_number, is_active, sort_order")
      .eq("subject_id", subjectId)
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
