import { NextRequest } from "next/server";
import { ApiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function parseRange(range: string) {
  if (!range || range === "30d") {
    const to = new Date();
    const from = new Date(to);
    from.setDate(to.getDate() - 30);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (range === "7d") {
    const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 7); return { from: from.toISOString(), to: to.toISOString() };
  }
  if (range === "90d") { const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 90); return { from: from.toISOString(), to: to.toISOString() }; }
  if (range === "today") { const to = new Date(); const from = new Date(); from.setHours(0, 0, 0, 0); return { from: from.toISOString(), to: to.toISOString() }; }
  if (range === "all") return { from: null, to: null };
  throw new ApiError(400, "Invalid analytics range.", "INVALID_RANGE");
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    const url = new URL(request.url);
    const range = url.searchParams.get("range") || "30d";
    const testId = url.searchParams.get("testId");
    const customFrom = url.searchParams.get("from");
    const customTo = url.searchParams.get("to");
    let from: string | null;
    let to: string | null;
    if (customFrom || customTo) {
      const fromDate = customFrom ? new Date(customFrom) : null;
      const toDate = customTo ? new Date(customTo) : null;
      if (!fromDate || !toDate || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
        throw new ApiError(400, "A valid from/to date range is required.", "INVALID_DATE_RANGE");
      }
      from = fromDate.toISOString();
      to = toDate.toISOString();
    } else {
      ({ from, to } = parseRange(range));
    }

    const admin = createAdminClient();

    const [
      usersResponse,
      activeUsersResponse,
      totalTestsResponse,
      publishedTestsResponse,
    ] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
      admin.from("mock_tests").select("id", { count: "exact", head: true }),
      admin.from("mock_tests").select("id", { count: "exact", head: true }).eq("is_published", true),
    ]);

    const attemptsQuery = admin.from("test_attempts").select("id", { count: "exact", head: true });
    const completedQuery = admin.from("test_attempts").select("id", { count: "exact", head: true }).in("status", ["submitted", "expired"]);
    if (from) { attemptsQuery.gte("started_at", from); completedQuery.gte("started_at", from); }
    if (to) { attemptsQuery.lte("started_at", to); completedQuery.lte("started_at", to); }
    if (testId) { attemptsQuery.eq("mock_test_id", testId); completedQuery.eq("mock_test_id", testId); }

    const [attemptsResult, completedAttemptsResult, averagesResult, topTestsResult, trendsResult] = await Promise.all([
      attemptsQuery,
      completedQuery,
      admin.rpc("get_admin_assessment_metrics", {
        p_from: from,
        p_to: to,
        p_test_id: testId,
      }),
      admin.rpc("get_test_popularity", { p_from: from, p_to: to, p_limit: 10 }),
      admin.rpc("get_daily_attempts_summary", { p_from: from, p_to: to }),
    ]);

    const queryErrors = [
      usersResponse.error,
      activeUsersResponse.error,
      totalTestsResponse.error,
      publishedTestsResponse.error,
      attemptsResult.error,
      completedAttemptsResult.error,
      averagesResult.error,
      topTestsResult.error,
      trendsResult.error,
    ];
    const queryError = queryErrors.find((error) => error !== null);
    if (queryError) throw queryError;

    const averages = averagesResult.data?.[0];

    return apiSuccess({
      users: { total: usersResponse.count ?? 0, active: activeUsersResponse.count ?? 0 },
      tests: { total: totalTestsResponse.count ?? 0, published: publishedTestsResponse.count ?? 0 },
      attempts: { total: attemptsResult.count ?? 0, completed: completedAttemptsResult.count ?? 0 },
      averages: {
        averageScore: Number(averages?.average_score) || 0,
        averagePercentage: Number(averages?.average_percentage) || 0,
        averageAccuracy: Number(averages?.average_accuracy) || 0,
      },
      topTests: topTestsResult.data ?? [],
      subjectPerformance: null,
      trends: trendsResult.data ?? [],
    });
  } catch (err) {
    return handleApiError(err);
  }
}
