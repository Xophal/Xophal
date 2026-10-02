import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  Brain,
  Check,
  CheckCircle2,
  Circle,
  Flame,
  Lightbulb,
  ListChecks,
  type LucideIcon,
  LockKeyhole,
  Play,
  RotateCcw,
  Target,
  Trophy,
  TrendingUp,
  Zap,
  X,
} from "lucide-react";
import { createTranslator } from "@/lib/i18n";
import type { DashboardData } from "@/lib/dashboard/types";
import type { LeaderboardPeriod } from "@/lib/dashboard/queries";
import { DashboardEmpty, DashboardSection, ProgressBar } from "./ui";
import StudyCalendar from "./StudyCalendar";
import DashboardHero from "./DashboardHero";

const t = createTranslator("en");

const numberFormat = new Intl.NumberFormat("en-IN");
const scoreColor = "var(--dashboard-score)";
const accuracyColor = "var(--dashboard-accent)";

function percent(value: number | null) {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function dateLabel(value: string | null, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "UTC" }).format(date);
}

function toneClasses(tone: string) {
  const tones: Record<string, string> = {
    emerald: "text-[#0b4cc2] bg-[#0b4cc2]/10",
    sky: "text-[#3974d4] bg-[#3974d4]/10",
    amber: "text-[#b86b00] bg-[#ff8a00]/10",
    rose: "text-rose-300 bg-rose-400/10",
    slate: "text-slate-300 bg-white/5",
  };
  return tones[tone] ?? tones.slate;
}

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="dashboard-section-link inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2">
      {children}<ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

function PerformanceChart({ data }: { data: DashboardData["performance"] }) {
  if (data.series.length < 3) {
    return <DashboardEmpty title={t("performance.empty")} description={t("performance.subtitle")} actionHref="/mock-tests" actionLabel={t("state.emptyAction")} />;
  }

  const width = 640;
  const height = 220;
  const inset = 24;
  const xFor = (index: number) => inset + (index * (width - inset * 2)) / (data.series.length - 1);
  const yFor = (value: number) => inset + ((100 - value) * (height - inset * 2)) / 100;
  const scorePoints = data.series.map((point, index) => `${xFor(index)},${yFor(point.score)}`).join(" ");
  const accuracyPoints = data.series
    .filter((point) => point.accuracy !== null)
    .map((point) => {
      const index = data.series.indexOf(point);
      return `${xFor(index)},${yFor(point.accuracy ?? 0)}`;
    })
    .join(" ");

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300" aria-label={t("dashboard.chartLegend")}>
        <span className="inline-flex items-center gap-2"><span className="dashboard-chart-dot dashboard-chart-dot--score" />{t("performance.scoreLegend")}</span>
        <span className="inline-flex items-center gap-2"><span className="dashboard-chart-dot dashboard-chart-dot--accuracy" />{t("performance.accuracyLegend")}</span>
      </div>
      <div className="w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full overflow-visible" role="img" aria-label={t("performance.subtitle")} preserveAspectRatio="none">
          {[0, 25, 50, 75, 100].map((tick) => (
            <g key={tick}>
              <line x1={inset} x2={width - inset} y1={yFor(tick)} y2={yFor(tick)} stroke="currentColor" className="text-white/10" strokeDasharray={tick === 0 ? undefined : "3 6"} />
              <text x="0" y={yFor(tick) + 4} fill="currentColor" className="fill-slate-500" fontSize="11">{tick}</text>
            </g>
          ))}
          <polyline points={scorePoints} fill="none" stroke={scoreColor} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          {accuracyPoints ? <polyline points={accuracyPoints} fill="none" stroke={accuracyColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 5" /> : null}
          {data.series.map((point, index) => (
            <g key={point.id}>
              <circle cx={xFor(index)} cy={yFor(point.score)} r="4.5" fill={scoreColor} stroke="hsl(var(--card))" strokeWidth="2" />
              {point.accuracy !== null ? <circle cx={xFor(index)} cy={yFor(point.accuracy)} r="3.5" fill={accuracyColor} stroke="hsl(var(--card))" strokeWidth="1.5" /> : null}
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${data.series.length}, minmax(0, 1fr))` }}>
        {data.series.map((point) => (
          <span key={point.id} title={point.title} className="truncate text-center text-[10px] text-slate-500">{point.label}</span>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value, note, icon: Icon, tone }: { label: string; value: string; note: string; icon: LucideIcon; tone: string }) {
  return (
    <article className={`dashboard-metric dashboard-metric-${tone} min-w-0`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</h2>
        <Icon className="dashboard-metric-icon h-4 w-4 shrink-0" aria-hidden="true" />
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-white sm:text-3xl">{value}</p>
      <p className="mt-1 min-h-8 text-xs leading-4 text-slate-400">{note}</p>
    </article>
  );
}

function ChartStats({ data }: { data: DashboardData["performance"] }) {
  const stats = [
    [t("performance.testsCompleted"), numberFormat.format(data.testsCompleted)],
    [t("performance.averageTime"), data.averageMinutes === null ? "—" : `${data.averageMinutes} ${t("dashboard.minutesShort")}`],
    [t("performance.questionsSolved"), numberFormat.format(data.questionsSolved)],
  ];
  return <div className="mt-5 grid grid-cols-1 gap-2 border-t border-white/10 pt-4 sm:grid-cols-3">
    {stats.map(([label, value]) => <div key={label} className="min-w-0"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold tabular-nums text-white">{value}</p></div>)}
  </div>;
}

export default function StudentDashboard({
  data,
  fullName,
  period,
  isLocalPreview = false,
}: {
  data: DashboardData;
  fullName: string | null;
  period: LeaderboardPeriod;
  isLocalPreview?: boolean;
}) {
  const goal = data.todayGoal;
  const continuation = data.continuation;
  const weakPracticeHref = data.weakAreas[0]?.practiceHref ?? "/mock-tests";
  const levelAfterNext = data.level.level + 1;
  const selectedDay = data.calendar.find((day) => day.isToday)?.date ?? data.calendar.at(-1)?.date ?? "";

  return (
    <div className="student-dashboard premium-dashboard-shell mx-auto max-w-[1500px] space-y-4 sm:space-y-5">
      {isLocalPreview ? <p role="status" className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">Local preview. Supabase is not connected, so saved activity and progress are not loaded.</p> : null}
      <DashboardHero data={data} fullName={fullName} />

      {data.onboarding.isNewStudent ? (
        <section className="premium-panel dashboard-surface p-5 sm:p-6" aria-labelledby="onboarding-title">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="dashboard-eyebrow">{t("onboarding.progress", { done: data.onboarding.done, total: data.onboarding.total })}</p><h2 id="onboarding-title" className="mt-1 text-xl font-semibold text-white">{t("onboarding.title")}</h2><p className="mt-1 text-sm text-slate-400">{t("onboarding.subtitle")}</p></div>
            <Link href="/mock-tests" className="dashboard-primary-action inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><Play className="h-4 w-4" aria-hidden="true" />{t("onboarding.cta")}</Link>
          </div>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.onboarding.steps.map((step, index) => (
              <li key={step.id} className="flex min-w-0 items-start gap-3 border-t border-white/10 pt-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${step.done ? "bg-emerald-400/15 text-emerald-200" : "bg-white/5 text-slate-400"}`}>{step.done ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}</span>
                <div className="min-w-0"><p className="text-sm font-medium text-white">{t(step.labelKey)}</p><p className="mt-1 text-xs text-slate-500">{step.done ? t(step.doneKey) : t("onboarding.locked")}</p></div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Key performance">
        <MetricCard label={t("kpi.averageScore")} value={percent(data.performance.averageScore)} note={data.performance.averageScore === null ? t("kpi.noData") : t("kpi.fromAttempts")} icon={TrendingUp} tone="blue" />
        <MetricCard label={t("kpi.accuracy")} value={percent(data.performance.accuracy)} note={data.performance.accuracy === null ? t("kpi.noData") : t("kpi.fromAttempts")} icon={Target} tone="green" />
        <MetricCard label={t("kpi.testsCompleted")} value={numberFormat.format(data.performance.testsCompleted)} note={t("kpi.fromAttempts")} icon={CheckCircle2} tone="violet" />
        <MetricCard label={t("kpi.currentStreak")} value={data.streak.hasActivity ? t("progress.days", { count: data.streak.current }) : "—"} note={data.streak.hasActivity ? t("progress.streakSource") : t("kpi.streakNoData")} icon={Flame} tone="orange" />
      </section>

      <DashboardSection labelledBy="today-goal-title" eyebrow={t("hero.eyebrow")} title={t("goal.title")} subtitle={t("goal.subtitle")} source={t("goal.source")}>
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-white">{t("goal.progress", { done: goal.completed, total: goal.total })}</p><p className="text-sm tabular-nums text-slate-300">{goal.percent}%</p></div>
            <ProgressBar value={goal.percent} label={t("goal.title")} tone="emerald" />
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {goal.tasks.map((task) => (
                <li key={task.id} className={`flex items-start gap-2 text-sm ${task.available ? "text-slate-200" : "text-slate-500"}`}>
                  {task.available && task.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-label="Completed" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />}
                  <span>{t(task.labelKey, task.params)}{!task.available && task.noteKey ? <span className="mt-0.5 block text-xs text-slate-500">{t(task.noteKey)}</span> : null}</span>
                </li>
              ))}
            </ul>
          </div>
          <Link href={continuation?.href ?? "/mock-tests"} className="dashboard-primary-action inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><ArrowRight className="h-4 w-4" aria-hidden="true" />{t("goal.cta")}</Link>
        </div>
        {!goal.hasSignal ? <p className="mt-4 text-sm text-slate-400">{t("goal.empty")}</p> : null}
      </DashboardSection>

      <DashboardSection labelledBy="quick-actions-title" eyebrow={t("dashboard.section.today")} title={t("quick.title")}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <QuickAction href="/mock-tests" icon={Target} title={t("quick.startMockTest")} detail={t("quick.startMockTestDesc")} />
          <QuickAction href={weakPracticeHref} icon={Brain} title={t("quick.practiceWeak")} detail={t("quick.practiceWeakDesc")} />
          <QuickAction href="#wrong-answers" icon={RotateCcw} title={t("quick.reviewMistakes")} detail={t("quick.reviewMistakesDesc")} />
          <div className="dashboard-tool cursor-not-allowed opacity-75" aria-disabled="true"><span className="dashboard-tool-icon"><Flame className="h-5 w-5" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">{t("quick.dailyChallenge")}</span><span className="mt-1 block text-xs text-slate-400">{t("challenge.notLiveTitle")}</span></span><LockKeyhole className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" /></div>
        </div>
      </DashboardSection>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <DashboardSection labelledBy="continue-title" eyebrow={t("continue.title")} title={continuation ? continuation.title : t("continue.emptyTitle")}>
          {continuation ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300"><span>{t("continue.progress", { answered: continuation.answered, total: continuation.total })}</span><span>{t("continue.lastActive")}: {dateLabel(continuation.lastActiveIso)}</span></div>
              <div className="mt-3"><ProgressBar value={continuation.percent} label={t("continue.progress", { answered: continuation.answered, total: continuation.total })} /></div>
              <Link href={continuation.href} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-bold text-slate-950 hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><Play className="h-4 w-4" aria-hidden="true" />{t("continue.cta")}</Link>
            </div>
          ) : <DashboardEmpty title={t("continue.emptyTitle")} description={t("continue.emptyDesc")} actionHref="/mock-tests" actionLabel={t("continue.emptyCta")} />}
        </DashboardSection>

        <DashboardSection labelledBy="recommended-title" eyebrow={t("dashboard.section.nextStep")} title={t("recommended.title")} subtitle={t("recommended.subtitle")} source={t("recommended.source")}>
          {data.recommendations.length ? <ul className="divide-y divide-white/10">
            {data.recommendations.slice(0, 3).map((recommendation) => (
              <li key={recommendation.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0"><p className="truncate font-semibold text-white">{recommendation.name}</p><p className="mt-1 text-xs text-slate-400">{t(recommendation.reasonKey)} · {t("recommended.suggested")}: {t("challenge.questions", { count: recommendation.suggestedQuestions })}{recommendation.estimatedMinutes === null ? "" : ` · ~${recommendation.estimatedMinutes} ${t("dashboard.minutesShort")}`}</p><p className="mt-1 text-xs text-slate-500">{t("weak.accuracy", { accuracy: recommendation.accuracy ?? 0 })} · {t("weak.attempted", { count: recommendation.attempted })}</p></div>
                <Link href={recommendation.href} className="dashboard-inline-action inline-flex min-h-10 items-center gap-1 rounded-lg border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2">{t("recommended.cta")}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
              </li>
            ))}
          </ul> : <DashboardEmpty title={t("recommended.emptyTitle")} description={t("recommended.emptyDesc")} actionHref="/mock-tests" actionLabel={t("state.emptyAction")} />}
        </DashboardSection>
      </div>

      <DashboardSection labelledBy="performance-title" eyebrow={t("dashboard.section.analyze")} title={t("performance.title")} subtitle={t("performance.subtitle")}>
        <PerformanceChart data={data.performance} />
        <ChartStats data={data.performance} />
      </DashboardSection>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <DashboardSection labelledBy="subjects-title" eyebrow={t("dashboard.section.performance")} title={t("subjects.title")} subtitle={t("subjects.subtitle")}>
          {data.subjects.length ? <ul className="space-y-4">
            {data.subjects.slice(0, 6).map((subject) => (
              <li key={subject.id} className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2"><div className="min-w-0"><Link href={subject.practiceHref} className="truncate font-semibold text-white hover:text-cyan-200">{subject.name}</Link><p className="mt-1 text-xs text-slate-500">{t("subjects.attempted", { count: subject.attempted })} · {t("subjects.averageScore")}: {percent(subject.averageScore)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${toneClasses(subject.band.tone)}`}>{subject.lowSample ? t("subjects.lowSample") : t(subject.band.labelKey)}</span></div>
                <div className="mt-2 flex items-center gap-3"><div className="min-w-0 flex-1"><ProgressBar value={subject.accuracy ?? 0} label={`${subject.name} ${percent(subject.accuracy)}`} tone={subject.band.tone === "rose" ? "rose" : subject.band.tone === "amber" ? "amber" : "emerald"} /></div><span className="w-12 text-right text-sm font-semibold tabular-nums text-white">{percent(subject.accuracy)}</span></div>
              </li>
            ))}
          </ul> : <DashboardEmpty title={t("subjects.title")} description={t("subjects.empty")} />}
        </DashboardSection>

        <DashboardSection labelledBy="weak-title" eyebrow={t("dashboard.section.focus")} title={t("weak.title")} subtitle={t("weak.subtitle")}>
          {data.weakAreas.length ? <ol className="divide-y divide-white/10">
            {data.weakAreas.map((area, index) => (
              <li key={area.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-400/10 text-sm font-bold text-rose-200">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate font-semibold text-white">{area.name}</p><p className="mt-1 text-xs text-slate-400">{t("weak.accuracy", { accuracy: area.accuracy ?? 0 })} · {t("weak.attempted", { count: area.attempted })}</p></div><Link href={area.practiceHref} className="inline-flex min-h-10 items-center rounded-lg border border-white/15 px-3 text-sm font-semibold text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">{t("weak.cta")}</Link></li>
            ))}
          </ol> : <DashboardEmpty title={t("weak.empty")} description={t("weak.rule", { min: 10, accuracy: 60 })} />}
        </DashboardSection>
      </div>

      <DashboardSection labelledBy="mastery-title" eyebrow={t("nav.practice")} title={t("mastery.title")} subtitle={t("mastery.subtitle")} action={<SectionLink href="/learn">{t("mastery.viewAll")}</SectionLink>}>
        {data.topics.length ? <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {data.topics.slice(0, 8).map((topic) => (
            <li key={topic.id} className="min-w-0"><div className="flex items-center justify-between gap-2"><Link href={topic.practiceHref} className="truncate text-sm font-semibold text-white hover:text-cyan-200">{topic.name}</Link><span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${toneClasses(topic.band.tone)}`}>{topic.lowSample ? t("mastery.band.insufficient") : t(topic.band.labelKey)}</span></div><div className="mt-2 flex items-center gap-3"><div className="min-w-0 flex-1"><ProgressBar value={topic.accuracy ?? 0} label={`${topic.name} ${percent(topic.accuracy)}`} tone={topic.band.tone === "rose" ? "rose" : topic.band.tone === "amber" ? "amber" : "emerald"} /></div><span className="text-xs tabular-nums text-slate-300">{percent(topic.accuracy)}</span></div><p className="mt-1 text-xs text-slate-500">{t("mastery.attempted", { count: topic.attempted })}</p></li>
          ))}
        </ul> : <DashboardEmpty title={t("mastery.title")} description={t("mastery.empty")} actionHref="/mock-tests" actionLabel={t("state.emptyAction")} />}
      </DashboardSection>

      <div id="wrong-answers" className="scroll-mt-24">
        <DashboardSection labelledBy="wrong-title" eyebrow={t("dashboard.section.revise")} title={t("wrong.title")} subtitle={t("wrong.subtitle")} action={<span className="rounded-full bg-rose-400/10 px-3 py-1.5 text-xs font-semibold text-rose-200">{t("wrong.count", { count: data.wrongAnswers.total })}</span>} source={t("wrong.source")}>
          {data.wrongAnswers.items.length ? <ul className="divide-y divide-white/10">
            {data.wrongAnswers.items.map((item) => (
              <li key={`${item.attemptId}-${item.questionId}`} className="py-4 first:pt-0 last:pb-0"><div className="flex items-start gap-3"><X className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-medium leading-5 text-white">{item.questionText || item.attemptTitle}</p><p className="mt-1 text-xs text-slate-400">{item.topicName ?? t("wrong.untagged")} · {item.difficultyName ?? "—"} · {t("wrong.previousAttempt")}: {item.attemptTitle}</p><p className="mt-1 text-xs text-slate-500">{t("wrong.explanation")}: {item.explanationAvailable ? t("wrong.explanationAvailable") : t("wrong.explanationMissing")}</p></div><div className="flex shrink-0 flex-col gap-1 sm:flex-row"><Link href={item.attemptHref} className="inline-flex min-h-9 items-center justify-center rounded-md px-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-300/10">{t("wrong.review")}</Link><Link href={item.practiceHref} className="inline-flex min-h-9 items-center justify-center rounded-md px-2 text-xs font-semibold text-slate-200 hover:bg-white/5">{t("wrong.practiceSimilar")}</Link></div></div></li>
            ))}
          </ul> : <DashboardEmpty title={t("wrong.empty")} description={t("wrong.source")} />}
        </DashboardSection>
      </div>

      <DashboardSection labelledBy="insight-title" eyebrow={t("dashboard.insightSource")} title={t("dashboard.insightTitle")} subtitle={t("dashboard.insightSubtitle")}>
        {data.insight.available ? <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(15rem,0.7fr)]">
          <ul className="space-y-3">{data.insight.findings.length ? data.insight.findings.map((finding, index) => <li key={`${finding.key}-${index}`} className="flex gap-2 text-sm leading-6 text-slate-200"><Lightbulb className="mt-1 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />{t(finding.key, finding.params)}</li>) : <li className="text-sm text-slate-400">{t("insight.lowSample", { count: data.performance.testsCompleted })}</li>}</ul>
          <div className="rounded-lg border border-amber-300/15 bg-amber-300/5 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-amber-200">{t("insight.nextStep")}</p><p className="mt-2 text-sm leading-6 text-white">{t(data.insight.nextStep.key, data.insight.nextStep.params)}</p>{data.insight.practiceHref ? <Link href={data.insight.practiceHref} className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-amber-200 hover:text-amber-100">{t("insight.cta")}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link> : null}</div>
        </div> : <DashboardEmpty title={t("insight.empty")} description={t("insight.disclaimer")} actionHref="/mock-tests" actionLabel={t("state.emptyAction")} />}
      </DashboardSection>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <DashboardSection labelledBy="challenge-title" eyebrow={t("dashboard.section.daily")} title={t("challenge.title")}>
          <div className="flex items-start gap-3"><Flame className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" aria-hidden="true" /><div><p className="text-sm font-semibold text-white">{t("challenge.notLiveTitle")}</p><p className="mt-1 text-sm leading-6 text-slate-400">{t("challenge.notLiveDesc")}</p></div></div>
        </DashboardSection>

        <DashboardSection labelledBy="progress-title" eyebrow={t("dashboard.section.gamification")} title={t("progress.title")} source={t("progress.streakSource")}>
          <div className="grid grid-cols-2 gap-3">
            <ProgressFact icon={Flame} label={t("progress.streak")} value={data.streak.hasActivity ? t("progress.days", { count: data.streak.current }) : "—"} note={data.streak.hasActivity ? t("progress.streakSource") : t("progress.streakUnavailable")} />
            <ProgressFact icon={Zap} label={t("progress.xp")} value={data.level.available ? numberFormat.format(data.level.xp) : "—"} note={data.level.available ? t("progress.level") : t("progress.xpUnavailable")} />
            <ProgressFact icon={Award} label={t("progress.level")} value={data.level.available ? String(data.level.level) : "—"} note={data.level.available ? t("progress.toNextLevel", { percent: data.level.percent, level: levelAfterNext }) : t("progress.xpUnavailable")} />
            <ProgressFact icon={Trophy} label={t("progress.achievements")} value={data.achievements.total ? t("progress.achievementProgress", { earned: data.achievements.unlocked, total: data.achievements.total }) : "—"} note={data.achievements.total ? `${data.achievements.percent}%` : t("achievements.empty")} />
          </div>
          {data.level.available ? <div className="mt-4"><ProgressBar value={data.level.percent} label={t("progress.toNextLevel", { percent: data.level.percent, level: levelAfterNext })} tone="amber" /></div> : null}
        </DashboardSection>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <DashboardSection labelledBy="achievements-title" eyebrow={t("dashboard.section.milestones")} title={t("achievements.title")} action={<SectionLink href="/achievements">{t("achievements.viewAll")}</SectionLink>}>
          {data.achievements.total ? <>
            {data.achievements.items.some((item) => item.unlocked) ? <ul className="grid gap-2 sm:grid-cols-2">{data.achievements.items.filter((item) => item.unlocked).slice(0, 4).map((achievement) => <li key={achievement.id} className="flex min-w-0 items-start gap-3 rounded-lg border border-emerald-300/10 bg-emerald-300/5 p-3"><Award className="h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{achievement.name}</p><p className="mt-1 text-xs text-slate-400">{t("achievements.awarded", { date: dateLabel(achievement.earnedAt, { day: "numeric", month: "short", year: "numeric" }) })}</p></div></li>)}</ul> : <DashboardEmpty title={t("achievements.empty")} description={t("achievements.empty")} />}
            <p className="mt-4 text-xs text-slate-500">{t("progress.achievementProgress", { earned: data.achievements.unlocked, total: data.achievements.total })}</p>
          </> : <DashboardEmpty title={t("achievements.title")} description={t("achievements.empty")} />}
        </DashboardSection>

        <DashboardSection labelledBy="leaderboard-title" eyebrow={t("dashboard.section.compete")} title={t("leaderboard.title")} subtitle={t("leaderboard.subtitle")}>
          <div className="mb-4 flex flex-wrap gap-1" aria-label="Leaderboard period">
            {(["weekly", "monthly", "global", "exam"] as const).map((option) => <Link key={option} href={`/dashboard?period=${option}#leaderboard-title`} aria-current={period === option ? "page" : undefined} className={`inline-flex min-h-9 items-center rounded-md px-3 text-xs font-semibold ${period === option ? "bg-cyan-300 text-slate-950" : "text-slate-300 hover:bg-white/5"}`}>{t(`leaderboard.range.${option}`)}</Link>)}
          </div>
          {data.leaderboard.currentUser ? <div className="dashboard-rank-highlight flex items-center justify-between gap-3 rounded-lg border p-4"><div><p className="text-xs text-slate-400">{t("leaderboard.yourPosition")}</p><p className="mt-1 text-xl font-semibold text-white">#{data.leaderboard.currentUser.rank} · {t("leaderboard.you")}</p></div><p className="dashboard-rank-score text-sm font-semibold">{t("leaderboard.score", { xp: numberFormat.format(data.leaderboard.currentUser.xp) })}</p></div> : <DashboardEmpty title={t("leaderboard.notRanked")} description={t("leaderboard.empty")} />}
          {data.leaderboard.entries.length ? <ol className="mt-3 divide-y divide-white/10">{data.leaderboard.entries.slice(0, 5).map((entry) => <li key={`${entry.rank}-${entry.userId}`} className="flex items-center gap-3 py-2 text-sm"><span className="w-8 font-semibold tabular-nums text-slate-400">#{entry.rank}</span><span className="min-w-0 flex-1 truncate text-white">{entry.isCurrentUser ? t("leaderboard.you") : entry.name || t("leaderboard.student")}</span><span className="shrink-0 tabular-nums text-slate-300">{numberFormat.format(entry.xp)} XP</span></li>)}</ol> : null}
        </DashboardSection>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <DashboardSection labelledBy="activity-title" eyebrow={t("dashboard.section.history")} title={t("activity.title")} subtitle={t("activity.subtitle")}>
          {data.activity.length ? <ul className="divide-y divide-white/10">{data.activity.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-cyan-200">{item.inProgress ? <Play className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{item.title}</p><p className="mt-1 text-xs text-slate-400">{t(item.kindKey)} · {item.inProgress ? t("activity.inProgress") : t("activity.completedOn", { date: dateLabel(item.occurredAt) })}</p></div></div><div className="flex shrink-0 items-center gap-3">{item.score !== null ? <span className="text-sm font-semibold tabular-nums text-white">{percent(item.score)}</span> : null}{item.accuracy !== null ? <span className="hidden text-xs tabular-nums text-slate-400 sm:inline">{percent(item.accuracy)} {t("kpi.accuracy")}</span> : null}{item.href ? <Link href={item.href} aria-label={`${item.title}: ${t("activity.viewResult")}`} className="inline-flex h-10 w-10 items-center justify-center rounded-md text-cyan-300 hover:bg-cyan-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"><ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link> : null}</div></li>)}</ul> : <DashboardEmpty title={t("activity.title")} description={t("activity.empty")} />}
        </DashboardSection>

        <DashboardSection labelledBy="calendar-title" eyebrow={t("dashboard.section.consistency")} title={t("calendar.title")} subtitle={t("calendar.subtitle")}>
          <StudyCalendar days={data.calendar} initialDate={selectedDay} labels={{
            monday: t("calendar.weekdayMon"), tuesday: t("calendar.weekdayTue"), wednesday: t("calendar.weekdayWed"), thursday: t("calendar.weekdayThu"), friday: t("calendar.weekdayFri"), saturday: t("calendar.weekdaySat"), sunday: t("calendar.weekdaySun"),
            tests: t("calendar.tests"), questions: t("calendar.questions"), score: t("calendar.score"), minutes: t("calendar.minutes"), selected: t("calendar.selectedDay"), none: t("calendar.noActivity"), less: t("calendar.less"), more: t("calendar.more"),
          }} />
        </DashboardSection>
      </div>

      <DashboardSection labelledBy="study-plan-title" eyebrow={t("dashboard.section.routine")} title={t("plan.title")} action={data.studyPlan ? <SectionLink href="/study-planner">{t("plan.viewFull")}</SectionLink> : null} source={data.studyPlan ? t(data.studyPlan.sourceKey) : undefined}>
        {data.studyPlan ? <><p className="mb-3 text-sm font-semibold text-slate-200">{data.studyPlan.title}{data.studyPlan.startDate ? <span className="ml-2 text-xs font-normal text-slate-500">{t("plan.startedOn", { date: dateLabel(data.studyPlan.startDate, { day: "numeric", month: "short", year: "numeric" }) })}</span> : null}</p><ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{data.studyPlan.tasks.slice(0, 6).map((task) => <li key={task.id} className="flex min-w-0 items-start gap-2 border-t border-white/10 pt-3"><ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /><span className="min-w-0 text-sm text-slate-200">{task.label}<span className="mt-1 block text-xs text-slate-500">{task.isToday ? t("plan.dueToday") : task.dueDate ? dateLabel(task.dueDate) : t("plan.pending")}</span></span></li>)}</ul></> : <DashboardEmpty title={t("plan.emptyTitle")} description={t("plan.emptyDesc")} actionHref="/study-planner" actionLabel={t("plan.emptyCta")} />}
      </DashboardSection>
    </div>
  );
}

function QuickAction({ href, icon: Icon, title, detail }: { href: string; icon: LucideIcon; title: string; detail: string }) {
  return <Link href={href} className="dashboard-tool group min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"><span className="dashboard-tool-icon"><Icon className="h-5 w-5" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-400">{detail}</span></span><ArrowUpRight className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cyan-300" aria-hidden="true" /></Link>;
}

function ProgressFact({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note: string }) {
  return <div className="min-w-0 border-t border-white/10 pt-3"><div className="flex items-center gap-2 text-xs text-slate-400"><Icon className="h-4 w-4 shrink-0 text-cyan-200" aria-hidden="true" />{label}</div><p className="mt-2 break-words text-lg font-semibold tabular-nums text-white">{value}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{note}</p></div>;
}
