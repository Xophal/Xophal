import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CACHE_KEYS, CACHE_TTL } from "@/constants";
import { getCached, setCache } from "@/lib/redis";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Subject } from "@/types";

export async function GET(request: NextRequest) {
  try {
    await checkRateLimit(request);

    const classId = request.nextUrl.searchParams.get("classId");
    if (!classId) return apiError("classId is required", 400, "MISSING_PARAM");

    const supabase = await createClient();
    const { data: activeClass } = await supabase
      .from("classes")
      .select("id, boards!inner(is_active)")
      .eq("id", classId)
      .eq("is_active", true)
      .eq("boards.is_active", true)
      .maybeSingle();
    if (!activeClass) return apiError("Class not found", 404, "NOT_FOUND");

    const cacheKey = CACHE_KEYS.SUBJECTS(classId);
    const cached = await getCached<Subject[]>(cacheKey);
    if (cached) return apiSuccess(cached);

    const { data, error } = await supabase
      .from("subjects")
      .select("id, class_id, code, name, slug, description, icon_url, color, is_active, sort_order")
      .eq("class_id", classId)
      .eq("is_active", true)
      .order("sort_order");

    if (error) throw error;

    await setCache(cacheKey, data, CACHE_TTL.LONG);
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") {
      return apiError("Too many requests", 429, "RATE_LIMIT");
    }
    return handleApiError(error);
  }
}
