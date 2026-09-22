import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Analytics" };

export default async function StudentAnalyticsPage() {
  const session = await requireAuth();

  if (!session?.profile) {
    return <div className="p-8 text-sm text-muted-foreground">Please sign in to view analytics.</div>;
  }

  const supabase = await createClient();
  const [{ data: attempts }, { data: activity }] = await Promise.all([
    supabase.from("test_attempts").select("percentage, correct_count, wrong_count, time_spent_seconds").eq("user_id", session.user.id).in("status", ["submitted", "expired"]),
    supabase.from("user_daily_activity").select("minutes_studied").eq("user_id", session.user.id).order("activity_date", { ascending: false }).limit(7),
  ]);
  const completed = attempts ?? [];
  const answered = completed.reduce((sum, attempt) => sum + (attempt.correct_count ?? 0) + (attempt.wrong_count ?? 0), 0);
  const correct = completed.reduce((sum, attempt) => sum + (attempt.correct_count ?? 0), 0);
  const studyMinutes = activity?.reduce((sum, item) => sum + (item.minutes_studied ?? 0), 0) ?? completed.reduce((sum, attempt) => sum + Math.round((attempt.time_spent_seconds ?? 0) / 60), 0);
  const accuracy = answered ? Number(((correct / answered) * 100).toFixed(2)) : 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Analytics</h1>
        <p className="mt-2 text-sm text-muted-foreground">Track your study patterns, scores, and learning momentum.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Performance</CardTitle>
            <CardDescription>Overall accuracy</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{accuracy}%</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Study time</CardTitle>
            <CardDescription>Average per week</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{(studyMinutes / 60).toFixed(1)}h</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Consistency</CardTitle>
            <CardDescription>Current streak</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{session.profile.current_streak || 0}d</CardContent>
        </Card>
      </div>
    </div>
  );
}
