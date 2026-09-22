import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CACHE_KEYS, CACHE_TTL } from "@/constants";
import { getCached, setCache } from "@/lib/redis";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { getFallbackClassesForBoard, isSupabaseTableMissing } from "@/lib/board-data";
import type { Class } from "@/types";

export async function GET(request: NextRequest) {
  try {
    await checkRateLimit(request);

    const boardId = request.nextUrl.searchParams.get("boardId");
    const boardSlug = request.nextUrl.searchParams.get("boardSlug");

    if (!boardId && !boardSlug) {
      return apiError("boardId or boardSlug is required", 400, "MISSING_PARAM");
    }

    const supabase = await createClient();
    let resolvedBoardId = boardId;

    if (resolvedBoardId) {
      const { data: board } = await supabase
        .from("boards")
        .select("id")
        .eq("id", resolvedBoardId)
        .eq("is_active", true)
        .maybeSingle();
      if (!board) return apiError("Board not found", 404, "NOT_FOUND");
    }

    if (!resolvedBoardId && boardSlug) {
      const { data: board } = await supabase
        .from("boards")
        .select("id")
        .eq("slug", boardSlug)
        .eq("is_active", true)
        .single();
      if (!board) return apiError("Board not found", 404, "NOT_FOUND");
      resolvedBoardId = board.id;
    }

    if (!resolvedBoardId) {
      return apiError("Board not found", 404, "NOT_FOUND");
    }

    const cacheKey = CACHE_KEYS.CLASSES(resolvedBoardId);
    const cached = await getCached<Class[]>(cacheKey);
    if (cached) return apiSuccess(cached);

    const { data, error } = await supabase
      .from("classes")
      .select("id, board_id, code, name, slug, grade_number, is_active, sort_order")
      .eq("board_id", resolvedBoardId)
      .eq("is_active", true)
      .order("sort_order");

    if (error) {
      if (isSupabaseTableMissing(error)) {
        const fallback = getFallbackClassesForBoard(resolvedBoardId) as Class[];
        await setCache(cacheKey, fallback, CACHE_TTL.LONG);
        return apiSuccess(fallback);
      }
      throw error;
    }

    await setCache(cacheKey, data, CACHE_TTL.LONG);
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") {
      return apiError("Too many requests", 429, "RATE_LIMIT");
    }
    return handleApiError(error);
  }
}
