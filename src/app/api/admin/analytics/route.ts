import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api-utils";
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
    const subjectId = url.searchParams.get("subjectId");
    const parsed = parseRange(range);
    const from = url.searchParams.get("from") || parsed?.from;
    const to = url.searchParams.get("to") || parsed?.to;

    const admin = createAdminClient();

    // Users
    const [{ data: users }, { data: activeUsers }] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact" }),
      admin.from("profiles").select("id", { count: "exact" }).eq("is_active", true),
    ]);

    // Tests
    const [{ data: totalTests }, { data: publishedTests }] = await Promise.all([
      admin.from("mock_tests").select("id", { count: "exact" }),
      admin.from("mock_tests").select("id", { count: "exact" }).eq("is_published", true),
    ]);

    // Attempts overall
    const attemptsQuery = admin.from("test_attempts").select("id", { count: "exact" });
    const completedQuery = admin.from("test_attempts").select("id", { count: "exact" }).in("status", ["submitted", "expired"]);
    if (from) { attemptsQuery.gte("started_at", from); completedQuery.gte("started_at", from); }
    if (to) { attemptsQuery.lte("started_at", to); completedQuery.lte("started_at", to); }
    if (testId) { attemptsQuery.eq("mock_test_id", testId); completedQuery.eq("mock_test_id", testId); }

    const [{ data: attempts }, { data: completedAttempts }] = await Promise.all([attemptsQuery, completedQuery]);

    // Average metrics over completed attempts
    let avgScore = 0, avgPercentage = 0, avgAccuracy = 0;
    const avgResp = await admin
      .from("test_attempts")
      .select("avg(marks_obtained), avg(percentage), avg(correct_count) as avg_correct, avg(wrong_count) as avg_wrong", { count: "exact" })
      .in("status", ["submitted", "expired"]);
    if (avgResp.error) throw avgResp.error;
    if (avgResp.data && avgResp.data.length) {
      const row = avgResp.data[0] as any;
      avgScore = Number(row.avg) || Number(row.avg_marks_obtained) || Number(row.avg_marks_obtained) || Number(row.avg_marks_obtained || 0) || 0;
      avgPercentage = Number(row.avg_percentage) || Number(row.avg_percentage) || Number(row.avg_percentage || 0) || 0;
      const avgCorrect = Number(row.avg_correct) || 0; const avgWrong = Number(row.avg_wrong) || 0;
      avgAccuracy = (avgCorrect + avgWrong) > 0 ? Number(((avgCorrect / (avgCorrect + avgWrong)) * 100).toFixed(2)) : 0;
    }

    // Top tests by attempts
    let topTestsResp: any = null;
    try {
      topTestsResp = await admin.rpc("get_test_popularity", { p_from: from, p_to: to, p_limit: 10 });
    } catch {
      topTestsResp = null;
    }

    // Subject performance is handled as a safe null fallback because the typed
    // Supabase client does not support this grouped aggregate pattern here.
    const topTests: any[] = [];

    // Simple trends: completed attempts per day
    let trends: any = null;
    try {
      trends = await admin.rpc("daily_attempts_summary", { p_from: from, p_to: to });
    } catch {
      trends = null;
    }

    return apiSuccess({
      users: { total: users?.length ?? 0, active: activeUsers?.length ?? 0 },
      tests: { total: totalTests?.length ?? 0, published: publishedTests?.length ?? 0 },
      attempts: { total: attempts?.length ?? 0, completed: completedAttempts?.length ?? 0 },
      averages: { averageScore: avgScore, averagePercentage: avgPercentage, averageAccuracy: avgAccuracy },
      topTests,
      subjectPerformance: null,
      trends: trends || null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
