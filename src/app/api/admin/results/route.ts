import { NextRequest } from "next/server";
import { apiSuccess, handleApiError, ApiError } from "@/lib/api-utils";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") || "1");
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || "20")));
    const offset = (page - 1) * limit;
    const q = url.searchParams.get("q") || null;
    const testId = url.searchParams.get("testId");
    const userId = url.searchParams.get("userId");
    const status = url.searchParams.get("status");
    const dateFrom = url.searchParams.get("from");
    const dateTo = url.searchParams.get("to");
    const sort = url.searchParams.get("sort") || "submitted_at";
    const asc = url.searchParams.get("asc") === "1";

    const admin = createAdminClient();

    let query = admin.from("test_attempts").select(`id, user_id, mock_test_id, status, started_at, submitted_at, time_spent_seconds, marks_obtained, total_marks, percentage, correct_count, wrong_count, skipped_count, profiles(id, full_name, email), mock_tests(id, title)`, { count: "exact" });

    if (testId) query = query.eq("mock_test_id", testId);
    if (userId) query = query.eq("user_id", userId);
    if (status) query = query.eq("status", status);
    if (dateFrom) query = query.gte("submitted_at", dateFrom);
    if (dateTo) query = query.lte("submitted_at", dateTo);

    if (q) {
      // search in profile name or mock test title
      query = query.or(`profiles.full_name.ilike.%${q}%,mock_tests.title.ilike.%${q}%`);
    }

    query = query.order(sort, { ascending: asc }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    return apiSuccess({ items: data || [], page, limit, total: count || 0 });
  } catch (err) {
    return handleApiError(err);
  }
}
