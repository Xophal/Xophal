import { apiSuccess, ApiError, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
    const admin = createAdminClient();
    const [{ data: attempts }, { data: activity }] = await Promise.all([
      admin.from("test_attempts").select("percentage, correct_count, wrong_count, time_spent_seconds, submitted_at").eq("user_id", session.user.id).in("status", ["submitted", "expired"]),
      admin.from("user_daily_activity").select("minutes_studied, activity_date").eq("user_id", session.user.id).order("activity_date", { ascending: false }).limit(7),
    ]);
    const completed = attempts ?? [];
    const answered = completed.reduce((sum, attempt) => sum + (attempt.correct_count ?? 0) + (attempt.wrong_count ?? 0), 0);
    const correct = completed.reduce((sum, attempt) => sum + (attempt.correct_count ?? 0), 0);
    const minutes = activity?.reduce((sum, item) => sum + (item.minutes_studied ?? 0), 0) ?? completed.reduce((sum, attempt) => sum + Math.round((attempt.time_spent_seconds ?? 0) / 60), 0);
    const averagePercentage = completed.length ? completed.reduce((sum, attempt) => sum + Number(attempt.percentage ?? 0), 0) / completed.length : 0;
    return apiSuccess({ testsCompleted: completed.length, averagePercentage: Number(averagePercentage.toFixed(2)), accuracy: answered ? Number(((correct / answered) * 100).toFixed(2)) : 0, studyMinutes: minutes, currentStreak: session.profile?.current_streak ?? 0 });
  } catch (error) {
    return handleApiError(error);
  }
}
