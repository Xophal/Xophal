import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, BarChart3, Brain, CheckCircle2, Facebook, Flame, Instagram, MessageCircle, Play, Sparkles, Target, Trophy, Zap } from "lucide-react";
import Icon from "@/components/icons/Icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/constants";
import { getGreeting } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await requireAuth();
  if (!session?.profile) redirect(ROUTES.login);

  if (isAdminRole(session.profile)) {
    redirect("/admin");
  }

  const { profile } = session;
  const supabase = await createClient();

  const { count: testsTaken } = await supabase
    .from("test_attempts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .in("status", ["submitted", "expired"]);

  // Fetch recent attempts (limit to reasonable number) and compute aggregates
  const { data: attemptsData } = await supabase
    .from("test_attempts")
    .select("id, percentage, marks_obtained, total_marks, submitted_at, status, answered_count, correct_count, mock_tests(title, slug)")
    .eq("user_id", profile.id)
    .in("status", ["submitted", "expired"])
    .order("submitted_at", { ascending: false })
    .limit(1000);

  const recentAttempts = (attemptsData ?? []).slice(0, 5);
  const getAttemptTitle = (attempt: { mock_tests?: { title?: string | null; slug?: string | null } | { title?: string | null; slug?: string | null }[] | null }) => {
    const relation = attempt.mock_tests;
    if (Array.isArray(relation)) return relation[0]?.title ?? "Mock Test";
    if (relation && typeof relation === "object") return relation.title ?? "Mock Test";
    return "Mock Test";
  };

  // Compute aggregated stats from fetched attempts (safe server-side calculation)
  const totalAttempts = (attemptsData ?? []).length;
  const completedAttempts = (attemptsData ?? []).filter((a) => a.status === "submitted").length;
  const avgScore = totalAttempts > 0 ? Math.round(((attemptsData ?? []).reduce((s, a) => s + (a.percentage ?? 0), 0) / totalAttempts) * 100) / 100 : 0;
  const bestScore = totalAttempts > 0 ? Math.max(...(attemptsData ?? []).map((a) => a.percentage ?? 0)) : 0;
  const totalAnswered = (attemptsData ?? []).reduce((s, a) => s + (a.answered_count ?? 0), 0);
  const totalCorrect = (attemptsData ?? []).reduce((s, a) => s + (a.correct_count ?? 0), 0);
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 10000) / 100 : 0;

  const quickLinks = [
    { href: ROUTES.learn, icon: "BookOpen", label: "Continue Learning", desc: "Pick up where you left off" },
    { href: "/mock-tests", icon: "Target", label: "Mock Tests", desc: "Practice with timed tests" },
    { href: ROUTES.studyPlanner, icon: "Brain", label: "AI Study Planner", desc: "Personalized study schedule" },
    { href: ROUTES.analytics, icon: "BarChart3", label: "Analytics", desc: "Track your performance" },
  ];

  // Score trend is built only from real attempt rows (newest first, shown oldest -> newest).
  const scoreTrend = (attemptsData ?? [])
    .filter((attempt) => typeof attempt.percentage === "number")
    .slice(0, 8)
    .map((attempt) => ({
      id: attempt.id,
      title: getAttemptTitle(attempt),
      percentage: Math.max(0, Math.min(100, attempt.percentage ?? 0)),
      label: attempt.submitted_at
        ? new Date(attempt.submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
        : "-",
    }))
    .reverse();

  const latestScore = scoreTrend.length ? scoreTrend[scoreTrend.length - 1].percentage : null;
  const previousScore = scoreTrend.length > 1 ? scoreTrend[scoreTrend.length - 2].percentage : null;
  const scoreDelta = latestScore !== null && previousScore !== null ? latestScore - previousScore : null;

  const firstName = profile?.full_name?.split(" ")[0] || "Student";
  const streak = profile?.current_streak || 0;
  const level = profile?.level || 1;
  const nextLevelXp = level * 500;
  const xpProgress = Math.min(100, Math.round(((profile?.total_xp || 0) / nextLevelXp) * 100));

  return (
    <div className="student-dashboard mx-auto max-w-[1400px] px-1 py-2 sm:px-2 lg:px-4">
      <section className="dashboard-hero relative overflow-hidden rounded-[28px] border border-white/10 px-5 py-7 sm:px-8 sm:py-9">
        <div className="dashboard-hero-grid" />
        <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200">
              <Sparkles className="h-3.5 w-3.5" /> Your learning command center
            </div>
            <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">{getGreeting()}, {firstName}.</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300 sm:text-base">A focused session today compounds into a stronger exam day tomorrow. Keep your momentum moving.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild className="dashboard-primary-action rounded-full px-5">
                <Link href="/mock-tests"><Play className="mr-2 h-4 w-4 fill-current" /> Start a mock test</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full border-white/15 bg-white/5 px-5 text-white hover:bg-white/10 hover:text-white">
                <Link href={ROUTES.learn}>Continue learning <ArrowUpRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
          <div className="dashboard-level-panel w-full max-w-xs rounded-2xl border border-white/10 bg-black/15 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs text-slate-300"><span>Level {level} progress</span><span>{profile?.total_xp || 0} / {nextLevelXp} XP</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-400" style={{ width: `${xpProgress}%` }} /></div>
            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-200"><Zap className="h-3.5 w-3.5" /> {xpProgress}% toward your next level</div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Current streak", value: `${streak} days`, icon: Flame, tone: "orange", note: streak > 0 ? "Keep it alive today" : "Start your first streak" },
          { label: "Tests completed", value: `${completedAttempts}`, icon: CheckCircle2, tone: "green", note: `${testsTaken || 0} total attempts` },
          { label: "Average score", value: `${avgScore}%`, icon: BarChart3, tone: "blue", note: `Best score ${bestScore}%` },
          { label: "Accuracy", value: `${accuracy}%`, icon: Target, tone: "violet", note: `${totalCorrect} correct answers` },
        ].map(({ label, value, icon: MetricIcon, tone, note }) => (
          <div key={label} className={`dashboard-metric dashboard-metric-${tone}`}>
            <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-400">{label}</span><MetricIcon className="h-4 w-4" /></div>
            <div className="mt-4 text-3xl font-semibold tracking-tight text-white">{value}</div>
            <p className="mt-1 text-xs text-slate-400">{note}</p>
          </div>
        ))}
      </section>

      <section className="dashboard-surface mt-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="dashboard-eyebrow">Performance trend</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Your last {scoreTrend.length || 0} scores</h2>
            <p className="mt-1 text-sm text-slate-400">Real scores from your submitted mock tests, oldest to newest.</p>
          </div>
          {scoreDelta !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
              {scoreDelta >= 0 ? "Up" : "Down"} {Math.abs(scoreDelta).toFixed(0)} pts vs previous
            </span>
          )}
        </div>

        {scoreTrend.length ? (
          <div className="mt-6">
            <ul className="flex h-40 items-end gap-2 sm:gap-3">
              {scoreTrend.map((point, index) => (
                <li key={point.id} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <span className="text-[0.6875rem] font-semibold tabular-nums text-slate-300">{point.percentage.toFixed(0)}%</span>
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-emerald-500/70 to-cyan-400/80"
                    style={{ height: `${Math.max(6, point.percentage * 1.1)}%` }}
                    title={`${point.title}: ${point.percentage}%`}
                  />
                  <span className="w-full truncate text-center text-[0.625rem] text-slate-400">{point.label}</span>
                  {index === scoreTrend.length - 1 && <span className="sr-only">Latest score</span>}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-400">
              Average across these attempts: {(scoreTrend.reduce((sum, p) => sum + p.percentage, 0) / scoreTrend.length).toFixed(1)}%
            </p>
          </div>
        ) : (
          <div className="dashboard-empty-state mt-6">
            <Target className="mx-auto mb-3 h-8 w-8 text-cyan-300" aria-hidden="true" />
            <p className="text-sm font-semibold text-white">No scores yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-400">
              Your trend appears after your first submitted mock test. It is the fastest way to see whether your preparation is actually improving.
            </p>
            <Button asChild className="mt-4 rounded-full">
              <Link href="/mock-tests">Take your first mock test</Link>
            </Button>
          </div>
        )}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="dashboard-surface p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><p className="dashboard-eyebrow">Your toolkit</p><h2 className="mt-1 text-xl font-semibold text-white">Choose your next move</h2><p className="mt-1 text-sm text-slate-400">Everything you need for a high-quality study session.</p></div>
            <Brain className="h-6 w-6 text-cyan-300" />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href} className="dashboard-tool group">
                <span className="dashboard-tool-icon"><Icon name={link.icon} className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">{link.label}</span><span className="mt-1 block text-xs text-slate-400">{link.desc}</span></span>
                <ArrowUpRight className="h-4 w-4 text-slate-500 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cyan-300" />
              </Link>
            ))}
          </div>
        </div>
        <div className="dashboard-focus-panel relative overflow-hidden p-5 sm:p-6">
          <div className="relative z-10"><p className="dashboard-eyebrow text-amber-200/70">Today&apos;s focus</p><h2 className="mt-2 text-2xl font-semibold text-white">Build a clean 25-minute streak.</h2><p className="mt-3 text-sm leading-6 text-slate-300">Take one focused test, review every wrong answer, and finish with one chapter revision.</p><Button asChild className="mt-7 rounded-full bg-amber-300 px-5 font-semibold text-slate-950 hover:bg-amber-200"><Link href={ROUTES.studyPlanner}>Open study planner <ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button></div>
          <Trophy className="absolute -bottom-5 -right-3 h-36 w-36 rotate-12 text-amber-200/10" />
        </div>
      </section>

      <section className="dashboard-surface mt-5 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="dashboard-eyebrow">Performance log</p><h2 className="mt-1 text-xl font-semibold text-white">Recent test attempts</h2></div><Link href={ROUTES.analytics} className="inline-flex items-center text-sm font-semibold text-cyan-300 hover:text-cyan-200">View analytics <ArrowUpRight className="ml-1 h-4 w-4" /></Link></div>
        <div className="p-4 sm:p-6">
          {!recentAttempts?.length ? <div className="dashboard-empty-state"><Target className="mx-auto mb-3 h-9 w-9 text-cyan-300" /><p className="text-sm text-slate-300">No tests taken yet.</p><Button asChild className="mt-4 rounded-full"><Link href="/mock-tests">Take your first mock test</Link></Button></div> : <div className="space-y-2">{recentAttempts.map((attempt) => <div key={attempt.id} className="dashboard-attempt"><div className="flex min-w-0 items-center gap-3"><div className="dashboard-attempt-mark"><CheckCircle2 className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{getAttemptTitle(attempt)}</p><p className="mt-1 text-xs text-slate-400">{attempt.marks_obtained}/{attempt.total_marks} marks</p></div></div><div className="flex items-center gap-3"><Badge variant={attempt.percentage >= 60 ? "success" : "secondary"}>{attempt.percentage}%</Badge><Button asChild size="sm" variant="outline" className="hidden rounded-full border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white sm:inline-flex"><Link href={`/test/result/${attempt.id}`}>View result</Link></Button></div></div>)}</div>}
        </div>
      </section>

      <div className="mt-5 flex items-center justify-between border-t border-white/10 px-1 pt-5 text-xs text-slate-500"><span>Stay connected with Xophal</span><div className="flex items-center gap-2"><a href="https://t.me/xopholstudent" target="_blank" rel="noreferrer" aria-label="Telegram" className="dashboard-social"><MessageCircle className="h-4 w-4" /></a><a href="https://www.instagram.com/xopholofficial" target="_blank" rel="noreferrer" aria-label="Instagram" className="dashboard-social"><Instagram className="h-4 w-4" /></a><a href="https://www.facebook.com/share/195Xu881nV/" target="_blank" rel="noreferrer" aria-label="Facebook" className="dashboard-social"><Facebook className="h-4 w-4" /></a></div></div>
    </div>
  );
}
