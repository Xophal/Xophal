import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CACHE_KEYS, CACHE_TTL } from "@/constants";
import { getCached, setCache } from "@/lib/redis";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { getFallbackBoards, isSupabaseTableMissing } from "@/lib/board-data";
import type { Board } from "@/types";

export async function GET(request: NextRequest) {
  try {
    await checkRateLimit(request);

    const cached = await getCached<Board[]>(CACHE_KEYS.BOARDS);
    if (cached) return apiSuccess(cached);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("boards")
      .select("id, code, name, slug, description, logo_url, is_active, sort_order")
      .eq("is_active", true)
      .order("sort_order");

    if (error) {
      if (isSupabaseTableMissing(error)) {
        const fallback = getFallbackBoards();
        await setCache(CACHE_KEYS.BOARDS, fallback, CACHE_TTL.LONG);
        return apiSuccess(fallback);
      }
      throw error;
    }

    await setCache(CACHE_KEYS.BOARDS, data, CACHE_TTL.LONG);
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") {
      return apiError("Too many requests", 429, "RATE_LIMIT");
    }
    return handleApiError(error);
  }
}
