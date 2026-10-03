import { NextRequest } from "next/server";
import { ApiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function parseRange(range?: string) {
  if (!range || range === "30d") {
    const to = new Date();
    const from = new Date(to);
    from.setDate(to.getDate() - 30);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (range === "7d") {
    const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 7); return { from: from.toISOString(), to: to.toISOString() };
  }
  if (range === "90d") { const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 90); return { from: from.toISOString(), to: to.toISOString() } }
  if (range === "today") { const to = new Date(); const from = new Date(); from.setHours(0,0,0,0); return { from: from.toISOString(), to: to.toISOString() } }
  // custom ISO range can be passed as from=...&to=...
  return null;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    const url = new URL(request.url);
    const range = url.searchParams.get("range") || "30d";
    const testId = url.searchParams.get("testId");
    const parsed = parseRange(range);
    const from = url.searchParams.get("from") || parsed?.from;
    const to = url.searchParams.get("to") || parsed?.to;
    if ((from && Number.isNaN(Date.parse(from))) || (to && Number.isNaN(Date.parse(to)))) {
      throw new ApiError(400, "from and to must be valid ISO dates.", "INVALID_DATE_RANGE");
    }

    const admin = createAdminClient();

    const [usersResult, activeUsersResult, totalTestsResult, publishedTestsResult] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
      admin.from("mock_tests").select("id", { count: "exact", head: true }),
      admin.from("mock_tests").select("id", { count: "exact", head: true }).eq("is_published", true),
    ]);
    const attemptsQuery = admin.from("test_attempts").select("id", { count: "exact" });
    const completedQuery = admin.from("test_attempts").select("id", { count: "exact" }).in("status", ["submitted", "expired"]);
    if (from) { attemptsQuery.gte("started_at", from); completedQuery.gte("started_at", from); }
    if (to) { attemptsQuery.lte("started_at", to); completedQuery.lte("started_at", to); }
    if (testId) { attemptsQuery.eq("mock_test_id", testId); completedQuery.eq("mock_test_id", testId); }

    if (usersResult.error) throw usersResult.error;
    if (activeUsersResult.error) throw activeUsersResult.error;
    if (totalTestsResult.error) throw totalTestsResult.error;
    if (publishedTestsResult.error) throw publishedTestsResult.error;

    const [attemptsResult, completedResult, metricsResult, topTestsResult, trendsResult, discoveryResult] = await Promise.all([
      attemptsQuery,
      completedQuery,
      admin.rpc("get_admin_assessment_metrics", { p_from: from, p_to: to, p_test_id: testId }),
      admin.rpc("get_test_popularity", { p_from: from, p_to: to, p_limit: 10 }),
      admin.rpc("get_daily_attempts_summary", { p_from: from, p_to: to }),
      admin.rpc("get_learning_discovery_metrics", { p_from: from, p_to: to }),
    ]);
    if (attemptsResult.error) throw attemptsResult.error;
    if (completedResult.error) throw completedResult.error;
    if (metricsResult.error) throw metricsResult.error;
    if (topTestsResult.error) throw topTestsResult.error;
    if (trendsResult.error) throw trendsResult.error;
    if (discoveryResult.error) throw discoveryResult.error;
    const metrics = Array.isArray(metricsResult.data) ? metricsResult.data[0] : null;
    const discovery = Array.isArray(discoveryResult.data) ? discoveryResult.data[0] : null;

    return apiSuccess({
      users: { total: usersResult.count ?? 0, active: activeUsersResult.count ?? 0 },
      tests: { total: totalTestsResult.count ?? 0, published: publishedTestsResult.count ?? 0 },
      attempts: { total: attemptsResult.count ?? 0, completed: completedResult.count ?? 0 },
      averages: {
        averageScore: Number(metrics?.average_score ?? 0),
        averagePercentage: Number(metrics?.average_percentage ?? 0),
        averageAccuracy: Number(metrics?.average_accuracy ?? 0),
      },
      topTests: topTestsResult.data ?? [],
      subjectPerformance: null,
      trends: trendsResult.data ?? null,
      discovery: {
        ebookViewers: Number(discovery?.ebook_viewers ?? 0),
        ebookToMockTestUsers: Number(discovery?.ebook_to_mock_test_users ?? 0),
        ebookToMockTestConversion: Number(discovery?.ebook_to_mock_test_conversion ?? 0),
        mockTestUsers: Number(discovery?.mock_test_users ?? 0),
        mockTestToEbookUsers: Number(discovery?.mock_test_to_ebook_users ?? 0),
        mockTestToEbookDiscovery: Number(discovery?.mock_test_to_ebook_discovery ?? 0),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
