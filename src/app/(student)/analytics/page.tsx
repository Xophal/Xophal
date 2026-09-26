import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Flame, Target, Timer, TrendingUp } from "lucide-react";
import { OutcomeBar, ScoreTrendChart, StudyTimeChart } from "@/components/analytics";
import { EmptyState } from "@/components/shared/empty-state";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  buildAttemptSeries,
  buildOutcomeSplit,
  buildStudySeries,
  buildSummary,
  describeTrend,
  type ActivityRow,
  type AttemptRow,
} from "@/lib/analytics";
import { ROUTES } from "@/constants";

export const metadata = { title: "Analytics" };

export default async function StudentAnalyticsPage() {
  const session = await requireAuth();
  if (!session?.profile) redirect(ROUTES.login);

  const supabase = await createClient();
  const [{ data: attemptRows }, { data: activityRows }] = await Promise.all([
    supabase
      .from("test_attempts")
      .select(
        "id, percentage, correct_count, wrong_count, skipped_count, time_spent_seconds, submitted_at, mock_tests(title)"
      )
      .eq("user_id", session.user.id)
      .in("status", ["submitted", "expired"])
      .order("submitted_at", { ascending: false })
      .limit(50),
    supabase
      .from("user_daily_activity")
      .select("activity_date, minutes_studied")
      .eq("user_id", session.user.id)
      .order("activity_date", { ascending: false })
      .limit(30),
  ]);

  const titleOf = (relation: unknown) => {
    const first = Array.isArray(relation) ? relation[0] : relation;
    if (first && typeof first === "object" && "title" in first) {
      const title = (first as { title?: string | null }).title;
      return title ?? null;
    }
    return null;
  };

  const attempts: AttemptRow[] = (attemptRows ?? []).map((row) => ({
    id: row.id,
    percentage: row.percentage,
    correct_count: row.correct_count,
    wrong_count: row.wrong_count,
    skipped_count: row.skipped_count,
    time_spent_seconds: row.time_spent_seconds,
    submitted_at: row.submitted_at,
    title: titleOf((row as { mock_tests?: unknown }).mock_tests),
  }));

  const activity: ActivityRow[] = (activityRows ?? []).map((row) => ({
    activity_date: row.activity_date,
    minutes_studied: row.minutes_studied,
  }));

  const summary = buildSummary(attempts, activity);
  const series = buildAttemptSeries(attempts);
  const outcomes = buildOutcomeSplit(attempts);
  const studySeries = buildStudySeries(activity, attempts, 7);
  const trend = describeTrend(summary.scoreDelta);
  const hasData = attempts.length > 0;
  if (!hasData) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Analytics</h1>
        <div className="exam-panel mt-4">
          <EmptyState
            icon="test"
            title="No mock tests completed yet"
            description="Your score trend, accuracy and study patterns appear here after your first submitted mock test. Each test you finish makes the next recommendation sharper."
            actionLabel="Explore mock tests"
            actionHref="/mock-tests"
          />
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Tests taken", value: summary.testsCompleted, hint: "completed attempts", icon: Target },
    { label: "Average score", value: `${summary.averageScore}%`, hint: `Best ${summary.bestScore}%`, icon: TrendingUp },
    { label: "Accuracy", value: `${summary.accuracy}%`, hint: `${summary.questionsCorrect} of ${summary.questionsAnswered} questions`, icon: Flame },
    { label: "Study time", value: `${Math.floor(summary.totalMinutes / 60)}h ${summary.totalMinutes % 60}m`, hint: "last 7 days", icon: Timer },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="exam-eyebrow">Performance</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Analytics</h1>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Every number here comes from your own submitted tests. {trend ?? ""}
          </p>
        </div>
        <Link
          href="/mock-tests"
          className="exam-cta inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Take another test
          <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="exam-stat">
              <dt className="flex items-center gap-1.5 exam-stat__label">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {stat.label}
              </dt>
              <dd className="exam-stat__value">{stat.value}</dd>
              <dd className="exam-stat__hint">{stat.hint}</dd>
            </div>
          );
        })}
      </dl>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="exam-panel p-5" aria-labelledby="trend-heading">
          <h2 id="trend-heading" className="exam-section-title">
            Score trend
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your last {series.length} submitted test{series.length === 1 ? "" : "s"}.
          </p>
          <div className="mt-4">
            <ScoreTrendChart data={series} />
          </div>
        </section>

        <section className="exam-panel p-5" aria-labelledby="outcomes-heading">
          <h2 id="outcomes-heading" className="exam-section-title">
            Question outcomes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Correct, incorrect and unanswered across every attempt.
          </p>
          <div className="mt-5">
            <OutcomeBar correct={outcomes.correct} incorrect={outcomes.incorrect} skipped={outcomes.skipped} />
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <section className="exam-panel p-5" aria-labelledby="study-heading">
          <h2 id="study-heading" className="exam-section-title">
            Study time
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Minutes studied over the last 7 days.</p>
          <div className="mt-4">
            <StudyTimeChart data={studySeries} />
          </div>
        </section>

        <section className="exam-panel p-5" aria-labelledby="attempts-heading">
          <h2 id="attempts-heading" className="exam-section-title">
            Recent attempts
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <caption className="sr-only">Your recent mock test attempts</caption>
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-semibold">Test</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Date</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Score</th>
                  <th scope="col" className="py-2 font-semibold">Result</th>
                </tr>
              </thead>
              <tbody>
                {[...series].reverse().map((attempt) => (
                  <tr key={attempt.id} className="border-b border-border/70 last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className="block max-w-[16rem] truncate font-medium text-foreground">
                        {attempt.title}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{attempt.label}</td>
                    <td className="py-2.5 pr-3 font-semibold tabular-nums text-foreground">
                      {attempt.score}%
                    </td>
                    <td className="py-2.5">
                      <Link
                        href={`/test/result/${attempt.id}`}
                        className="font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        View
                        <span className="sr-only"> {attempt.title} result</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Showing {series.length} of {summary.testsCompleted} completed attempts. Full history is
            available in each result page.
          </p>
        </section>
      </div>
    </div>
  );
}