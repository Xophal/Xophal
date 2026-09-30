import { getLevelFromXP, getXPForNextLevel } from "@/lib/utils";
import type { TextKey } from "@/lib/i18n";
import {
  APP_TIME_ZONE,
  CALENDAR_WEEKS,
  GOAL_DEFAULTS,
  MIN_SAMPLES,
  SCORE_TREND_POINTS,
  STREAK_MIN_QUALIFYING_MINUTES,
  STRONG_AREA_MIN_ACCURACY,
  TREND_DELTA_POINTS,
  WEAK_AREA_MAX_ACCURACY,
  masteryBand,
  suggestedSessionSize,
} from "./thresholds";
import type {
  AchievementSummary,
  ActivityItem,
  CalendarDay,
  Continuation,
  DashboardData,
  GoalTask,
  InsightFinding,
  LeaderboardEntry,
  LevelProgress,
  OnboardingStep,
  PerformancePoint,
  PerformanceSummary,
  QuestionMeta,
  RawActivity,
  RawAttempt,
  RawResponse,
  Recommendation,
  SlicePerformance,
  StreakSummary,
  StudyInsight,
  StudyPlanView,
  SubjectRef,
  TodayGoal,
  TopicRef,
  TrendDirection,
  WeakArea,
  WrongAnswerItem,
} from "./types";

/**
 * Deterministic dashboard maths.
 *
 * Every function here is pure: rows in, view models out. No I/O, no AI, no
 * randomness. A number on the dashboard either comes straight from a submitted
 * attempt/response row or is derived by one of the documented rules below,
 * which keeps the dashboard honest for a student with no data at all.
 */

// --- Small helpers ---------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clampPercent(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return round1(clamp(value, 0, 100));
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** `YYYY-MM-DD` for a Date in the app's reporting time zone. */
export function isoDateInTimeZone(date: Date, timeZone: string = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function todayIso(now: Date = new Date()): string {
  return isoDateInTimeZone(now);
}

/** ISO date of an instant, used for grouping attempts into days. */
export function isoDateOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return isoDateInTimeZone(date);
}

export function addDaysIso(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const base = Date.UTC(year, (month ?? 1) - 1, day ?? 1) + days * DAY_MS;
  return new Date(base).toISOString().slice(0, 10);
}

export function formatDayLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

export function formatFullDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function attemptTitle(attempt: { title?: string | null }): string {
  return attempt.title?.trim() || "Mock test";
}

export function isCompleted(attempt: RawAttempt): boolean {
  return attempt.status === "submitted" || attempt.status === "expired";
}

export function completedAttempts(attempts: RawAttempt[]): RawAttempt[] {
  return attempts.filter(isCompleted);
}

type Timestamped = { submitted_at?: string | null; updated_at?: string | null; started_at?: string | null };

/** Newest first, tolerant of missing timestamps. */
export function sortByRecency<T extends Timestamped>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const left = Date.parse(a.submitted_at ?? a.updated_at ?? a.started_at ?? "") || 0;
    const right = Date.parse(b.submitted_at ?? b.updated_at ?? b.started_at ?? "") || 0;
    return right - left;
  });
}

// --- Performance -----------------------------------------------------------

export function attemptAccuracy(responses: RawResponse[]): number | null {
  const answered = responses.filter((response) => response.is_correct !== null);
  if (!answered.length) return null;
  const correct = answered.filter((response) => response.is_correct === true).length;
  return round1((correct / answered.length) * 100);
}

export function describeDirection(delta: number | null): TrendDirection {
  if (delta === null) return "none";
  if (delta > TREND_DELTA_POINTS / 5) return "up";
  if (delta < -TREND_DELTA_POINTS / 5) return "down";
  return "flat";
}

export function groupResponsesByAttempt(responses: RawResponse[]): Map<string, RawResponse[]> {
  const grouped = new Map<string, RawResponse[]>();
  responses.forEach((response) => {
    const bucket = grouped.get(response.attempt_id);
    if (bucket) bucket.push(response);
    else grouped.set(response.attempt_id, [response]);
  });
  return grouped;
}

export function buildPerformance(attempts: RawAttempt[], responses: RawResponse[] = []): PerformanceSummary {
  const completed = sortByRecency(completedAttempts(attempts));
  const percentages = completed
    .map((attempt) => clampPercent(attempt.percentage))
    .filter((value): value is number => value !== null);

  const grouped = groupResponsesByAttempt(responses);
  const perAttemptAccuracy = (attemptId: string) => attemptAccuracy(grouped.get(attemptId) ?? []);

  const answeredEverywhere = completed.reduce((sum, attempt) => sum + toNumber(attempt.answered_count), 0);
  const correctEverywhere = completed.reduce((sum, attempt) => sum + toNumber(attempt.correct_count), 0);
  const analysed = [...grouped.values()].flat().filter((response) => response.is_correct !== null);
  const accuracyFromResponses = analysed.length
    ? round1((analysed.filter((response) => response.is_correct === true).length / analysed.length) * 100)
    : null;
  // Falls back to the attempt aggregates written by the submission RPC when
  // per-question rows were not loaded for the analysed window.
  const accuracy =
    accuracyFromResponses ??
    (answeredEverywhere > 0 ? round1((correctEverywhere / answeredEverywhere) * 100) : null);

  const series: PerformancePoint[] = [...completed]
    .reverse()
    .slice(-SCORE_TREND_POINTS)
    .filter((attempt) => clampPercent(attempt.percentage) !== null)
    .map((attempt) => ({
      id: attempt.id,
      label: formatDayLabel(isoDateOf(attempt.submitted_at)),
      title: attemptTitle(attempt),
      score: clampPercent(attempt.percentage) ?? 0,
      accuracy: perAttemptAccuracy(attempt.id),
    }));

  const scores = series.map((point) => point.score);
  const accuracies = series.map((point) => point.accuracy).filter((value): value is number => value !== null);
  const scoreDelta = scores.length >= 2 ? round1(scores[scores.length - 1] - scores[scores.length - 2]) : null;
  const accuracyDelta =
    accuracies.length >= 2 ? round1(accuracies[accuracies.length - 1] - accuracies[accuracies.length - 2]) : null;

  const minutes = completed.map((attempt) => toNumber(attempt.time_spent_seconds) / 60).filter((value) => value > 0);
  const averageScore = average(percentages);

  return {
    series,
    testsCompleted: completed.length,
    averageScore: averageScore === null ? null : round1(averageScore),
    bestScore: percentages.length ? round1(Math.max(...percentages)) : null,
    accuracy,
    questionsSolved: answeredEverywhere,
    questionsCorrect: correctEverywhere,
    averageMinutes: minutes.length ? Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length) : null,
    scoreDelta,
    accuracyDelta,
    trend: describeDirection(scoreDelta),
  };
}

// --- Streak ----------------------------------------------------------------

/**
 * Current streak = consecutive days ending today, or ending yesterday when the
 * student has not studied yet today. Both the start and the end of the run must
 * be backed by a submitted attempt or a recorded study-activity row.
 */
export function buildStreak(input: {
  activityDates: (string | null | undefined)[];
  attemptDates: (string | null | undefined)[];
  today: string;
}): StreakSummary {
  const unique = [
    ...new Set(
      [...input.activityDates, ...input.attemptDates].filter(
        (date): date is string => Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date))
      )
    ),
  ].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  const set = new Set(unique);
  const activeToday = set.has(input.today);
  let current = 0;

  if (unique.length) {
    let cursor = activeToday ? input.today : addDaysIso(input.today, -1);
    while (set.has(cursor)) {
      current += 1;
      cursor = addDaysIso(cursor, -1);
    }
  }

  let longest = 0;
  let run = 0;
  const ascending = [...unique].reverse();
  ascending.forEach((date, index) => {
    const previous = index > 0 ? ascending[index - 1] : null;
    run = previous && addDaysIso(previous, 1) === date ? run + 1 : 1;
    longest = Math.max(longest, run);
  });

  return { current, longest, activeToday, hasActivity: unique.length > 0, qualifyingDates: unique };
}

export const MIN_STREAK_MINUTES = STREAK_MIN_QUALIFYING_MINUTES;

// --- Topic / subject performance -------------------------------------------

export type SliceRef = { id: string; name: string; slug: string | null };

export type SliceBuildInput = {
  /** Only responses from completed attempts. */
  responses: RawResponse[];
  questionMeta: Map<string, QuestionMeta>;
  refs: SliceRef[];
  /** attempt_id -> submitted_at, used for recency and trend ordering. */
  attemptTimes: Map<string, string | null>;
  kind: "topic" | "subject";
  minSample: number;
  hrefFor: (slice: SliceRef) => string;
};

type SliceAccumulator = {
  attempted: number;
  correct: number;
  wrong: number;
  seconds: number;
  lastSeenAt: string | null;
  perAttempt: Map<string, { attempted: number; correct: number }>;
};

function sliceTrend(perAttempt: Map<string, { attempted: number; correct: number }>, attemptOrder: string[]): TrendDirection {
  const ordered = attemptOrder.filter((id) => perAttempt.has(id));
  if (ordered.length < 3) return "none";

  const share = (ids: string[]) => {
    const totals = ids.reduce(
      (acc, id) => {
        const entry = perAttempt.get(id);
        if (!entry) return acc;
        return { attempted: acc.attempted + entry.attempted, correct: acc.correct + entry.correct };
      },
      { attempted: 0, correct: 0 }
    );
    return totals.attempted > 0 ? (totals.correct / totals.attempted) * 100 : null;
  };

  const middle = Math.floor(ordered.length / 2);
  const older = share(ordered.slice(0, middle));
  const newer = share(ordered.slice(middle));
  if (older === null || newer === null) return "none";

  const delta = newer - older;
  if (delta > TREND_DELTA_POINTS) return "up";
  if (delta < -TREND_DELTA_POINTS) return "down";
  return "flat";
}

/**
 * Aggregates per-question answers into topic or subject performance.
 * Questions without a tag are skipped (never guessed into a bucket), and a
 * slice with fewer answers than `minSample` is marked `lowSample` so the UI can
 * say so instead of labelling the student.
 */
export function buildSlicePerformance(input: SliceBuildInput): SlicePerformance[] {
  const refById = new Map(input.refs.map((ref) => [ref.id, ref]));
  const attemptOrder = [...input.attemptTimes.entries()]
    .sort((a, b) => (Date.parse(a[1] ?? "") || 0) - (Date.parse(b[1] ?? "") || 0))
    .map(([id]) => id);

  const accumulators = new Map<string, SliceAccumulator>();

  input.responses.forEach((response) => {
    const meta = input.questionMeta.get(response.question_id);
    if (!meta) return;
    const sliceId = input.kind === "topic" ? meta.topic_id : meta.subject_id;
    if (!sliceId || !refById.has(sliceId)) return;
    if (response.is_correct === null) return; // unanswered questions are not accuracy

    const bucket =
      accumulators.get(sliceId) ??
      ({ attempted: 0, correct: 0, wrong: 0, seconds: 0, lastSeenAt: null, perAttempt: new Map() } as SliceAccumulator);

    bucket.attempted += 1;
    if (response.is_correct === true) bucket.correct += 1;
    else bucket.wrong += 1;
    bucket.seconds += toNumber(response.time_spent_seconds);

    const submittedAt = input.attemptTimes.get(response.attempt_id) ?? null;
    if (submittedAt && (!bucket.lastSeenAt || Date.parse(submittedAt) > Date.parse(bucket.lastSeenAt))) {
      bucket.lastSeenAt = submittedAt;
    }

    const perAttempt = bucket.perAttempt.get(response.attempt_id) ?? { attempted: 0, correct: 0 };
    perAttempt.attempted += 1;
    if (response.is_correct === true) perAttempt.correct += 1;
    bucket.perAttempt.set(response.attempt_id, perAttempt);

    accumulators.set(sliceId, bucket);
  });

  return [...accumulators.entries()]
    .map(([id, bucket]) => {
      const ref = refById.get(id) as SliceRef;
      const accuracy = round1((bucket.correct / bucket.attempted) * 100);
      const attemptScores = [...bucket.perAttempt.values()].map((entry) =>
        entry.attempted > 0 ? (entry.correct / entry.attempted) * 100 : 0
      );
      const averageScore = attemptScores.length ? round1(attemptScores.reduce((sum, value) => sum + value, 0) / attemptScores.length) : null;

      return {
        id,
        name: ref.name,
        slug: ref.slug,
        attempted: bucket.attempted,
        correct: bucket.correct,
        wrong: bucket.wrong,
        accuracy,
        averageScore,
        band: masteryBand(accuracy, bucket.attempted, input.minSample),
        trend: sliceTrend(bucket.perAttempt, attemptOrder),
        lowSample: bucket.attempted < input.minSample,
        lastSeenAt: bucket.lastSeenAt,
        practiceHref: input.hrefFor(ref),
      } satisfies SlicePerformance;
    })
    .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0));
}

/** Topics that clear the minimum sample AND sit under the weak-area accuracy. */
export function selectWeakAreas(slices: SlicePerformance[], limit = 3): WeakArea[] {
  return slices
    .filter((slice) => !slice.lowSample && (slice.accuracy ?? 100) < WEAK_AREA_MAX_ACCURACY)
    .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0))
    .slice(0, limit)
    .map((slice) => ({
      ...slice,
      reasonKey: (slice.accuracy ?? 100) < WEAK_AREA_MAX_ACCURACY / 2 ? "recommended.reason.needsPractice" : "recommended.reason.keepImproving",
    }));
}

/** Strong topics worth a short maintenance session. */
export function selectStrongAreas(slices: SlicePerformance[], limit = 2): SlicePerformance[] {
  return slices
    .filter((slice) => !slice.lowSample && (slice.accuracy ?? 0) >= STRONG_AREA_MIN_ACCURACY)
    .sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0))
    .slice(0, limit);
}

// --- Recommendations (deterministic rules, no AI) --------------------------

export type RecommendationInput = {
  topics: SlicePerformance[];
  subjects: SlicePerformance[];
  /** Topics missed in the most recent attempts. */
  recentWrongTopicIds: string[];
  /** Average answering time per slice id, in seconds. */
  secondsPerSlice: Map<string, number>;
  fallbackSeconds: number | null;
  limit?: number;
};

function estimateMinutes(sliceId: string, questions: number, input: RecommendationInput): number | null {
  const perQuestion = input.secondsPerSlice.get(sliceId) ?? input.fallbackSeconds;
  if (!perQuestion || perQuestion <= 0) return null;
  return Math.max(1, Math.round((perQuestion * questions) / 60));
}

function toRecommendation(
  slice: SlicePerformance,
  kind: "topic" | "subject",
  reasonKey: TextKey,
  input: RecommendationInput
): Recommendation {
  const suggestedQuestions = suggestedSessionSize({
    attempted: Math.max(slice.attempted, MIN_SAMPLES.topic),
    accuracy: slice.accuracy,
    wrongCount: slice.wrong,
  });
  return {
    id: slice.id,
    name: slice.name,
    kind,
    reasonKey,
    accuracy: slice.accuracy,
    attempted: slice.attempted,
    suggestedQuestions,
    estimatedMinutes: estimateMinutes(slice.id, suggestedQuestions, input),
    href: slice.practiceHref,
  };
}

/**
 * Rule order (first match wins, duplicates removed):
 *   1. weak topics            -> "Needs Practice"
 *   2. recently wrong topics  -> "Due for revision"
 *   3. mid-band topics        -> "Keep Improving"
 *   4. strong topics          -> "Maintain your strength"
 *   5. subject-level fallback when no topic has enough data yet
 */
export function buildRecommendations(input: RecommendationInput): Recommendation[] {
  const limit = input.limit ?? 4;
  const picked: Recommendation[] = [];
  const seen = new Set<string>();
  const add = (slice: SlicePerformance, kind: "topic" | "subject", reasonKey: TextKey) => {
    if (seen.has(slice.id)) return;
    seen.add(slice.id);
    picked.push(toRecommendation(slice, kind, reasonKey, input));
  };

  const usableTopics = input.topics.filter((topic) => !topic.lowSample);
  usableTopics
    .filter((topic) => (topic.accuracy ?? 100) < WEAK_AREA_MAX_ACCURACY)
    .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0))
    .forEach((topic) => add(topic, "topic", "recommended.reason.needsPractice"));

  input.recentWrongTopicIds.forEach((topicId) => {
    const topic = usableTopics.find((item) => item.id === topicId);
    if (topic) add(topic, "topic", "recommended.reason.revision");
  });

  usableTopics
    .filter((topic) => (topic.accuracy ?? 0) >= WEAK_AREA_MAX_ACCURACY && (topic.accuracy ?? 0) < STRONG_AREA_MIN_ACCURACY)
    .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0))
    .forEach((topic) => add(topic, "topic", "recommended.reason.keepImproving"));

  selectStrongAreas(usableTopics).forEach((topic) => add(topic, "topic", "recommended.reason.maintainStrength"));

  if (picked.length === 0) {
    const usableSubjects = input.subjects.filter((subject) => !subject.lowSample);
    usableSubjects
      .filter((subject) => (subject.accuracy ?? 100) < WEAK_AREA_MAX_ACCURACY)
      .forEach((subject) => add(subject, "subject", "recommended.reason.needsPractice"));
    usableSubjects
      .filter((subject) => (subject.accuracy ?? 0) >= WEAK_AREA_MAX_ACCURACY)
      .forEach((subject) => add(subject, "subject", "recommended.reason.keepImproving"));
  }

  return picked.slice(0, limit);
}

// --- Wrong answers ---------------------------------------------------------

export type WrongAnswerInput = {
  responses: RawResponse[];
  questionMeta: Map<string, QuestionMeta>;
  attemptById: Map<string, RawAttempt>;
  topicNameById: Map<string, string>;
  limit?: number;
};

function practiceHrefForTopicName(name: string | null): string {
  return name ? `/mock-tests?search=${encodeURIComponent(name)}` : "/mock-tests";
}

export function buildWrongAnswers(input: WrongAnswerInput): { total: number; items: WrongAnswerItem[] } {
  const incorrect = input.responses.filter((response) => response.is_correct === false);
  const ordered = [...incorrect].sort((a, b) => {
    const left = Date.parse(input.attemptById.get(a.attempt_id)?.submitted_at ?? "") || 0;
    const right = Date.parse(input.attemptById.get(b.attempt_id)?.submitted_at ?? "") || 0;
    if (left !== right) return right - left;
    return a.question_id < b.question_id ? -1 : 1;
  });

  const items = ordered.slice(0, input.limit ?? 5).map((response) => {
    const meta = input.questionMeta.get(response.question_id);
    const attempt = input.attemptById.get(response.attempt_id);
    const topicName = meta?.topic_id ? input.topicNameById.get(meta.topic_id) ?? null : null;
    const text = (meta?.question_text ?? "").replace(/\s+/g, " ").trim();
    return {
      attemptId: response.attempt_id,
      questionId: response.question_id,
      questionText: text.length > 160 ? `${text.slice(0, 157)}...` : text,
      topicName,
      difficultyName: meta?.difficulty_name ?? null,
      explanationAvailable: Boolean(meta?.has_explanation),
      attemptTitle: attempt ? attemptTitle(attempt) : "Mock test",
      submittedAt: attempt?.submitted_at ?? null,
      attemptHref: `/test/result/${response.attempt_id}`,
      practiceHref: practiceHrefForTopicName(topicName),
    } satisfies WrongAnswerItem;
  });

  return { total: incorrect.length, items };
}

// --- Today's goal ----------------------------------------------------------

export type TodayGoalInput = {
  today: string;
  /** Attempts submitted/expired today (already filtered by the caller). */
  todayAttempts: RawAttempt[];
  /** `user_daily_activity` row for today, when the table has one. */
  todayActivity: RawActivity | null;
  goalQuestions?: number;
  goalMinutes?: number;
  /** Daily challenge tables are not wired yet, so this stays false for now. */
  dailyChallengeAvailable?: boolean;
};

/** Minutes of work recorded today, preferring explicit study activity rows. */
export function todayMinutes(input: Pick<TodayGoalInput, "todayAttempts" | "todayActivity">): number {
  const activityMinutes = toNumber(input.todayActivity?.minutes_studied);
  if (activityMinutes > 0) return Math.round(activityMinutes);
  return Math.round(input.todayAttempts.reduce((sum, attempt) => sum + toNumber(attempt.time_spent_seconds) / 60, 0));
}

export function todayQuestionCount(input: Pick<TodayGoalInput, "todayAttempts" | "todayActivity">): number {
  const fromAttempts = input.todayAttempts.reduce((sum, attempt) => sum + toNumber(attempt.answered_count), 0);
  const fromActivity = toNumber(input.todayActivity?.questions_attempted);
  return Math.max(fromAttempts, fromActivity);
}

export function buildTodayGoal(input: TodayGoalInput): TodayGoal {
  const goalQuestions = input.goalQuestions ?? GOAL_DEFAULTS.questions;
  const goalMinutes = input.goalMinutes ?? GOAL_DEFAULTS.studyMinutes;

  const testsToday = input.todayAttempts.length + toNumber(input.todayActivity?.tests_completed);
  const questionsToday = todayQuestionCount(input);
  const minutesToday = todayMinutes(input);

  const tasks: GoalTask[] = [
    {
      id: "mock-test",
      labelKey: "goal.task.mockTest",
      done: testsToday > 0,
      available: true,
    },
    {
      id: "questions",
      labelKey: "goal.task.questions",
      params: { count: goalQuestions },
      done: questionsToday >= goalQuestions,
      available: true,
    },
    {
      id: "study-time",
      labelKey: "goal.task.studyTime",
      params: { minutes: goalMinutes },
      done: minutesToday >= goalMinutes,
      available: true,
    },
    {
      id: "daily-challenge",
      labelKey: "goal.task.dailyChallenge",
      done: false,
      available: Boolean(input.dailyChallengeAvailable),
      noteKey: "challenge.notLiveTitle",
    },
  ];

  const tracked = tasks.filter((task) => task.available);
  const completed = tracked.filter((task) => task.done).length;

  return {
    tasks,
    completed,
    total: tracked.length,
    percent: tracked.length ? Math.round((completed / tracked.length) * 100) : 0,
    hasSignal: testsToday > 0 || questionsToday > 0 || minutesToday > 0,
  };
}

// --- Study calendar --------------------------------------------------------

export function intensityForMinutes(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0;
  if (minutes < 15) return 1;
  if (minutes < 30) return 2;
  if (minutes < 60) return 3;
  return 4;
}

export function buildCalendar(input: {
  activity: RawActivity[];
  attempts: RawAttempt[];
  today: string;
  weeks?: number;
}): CalendarDay[] {
  const weeks = input.weeks ?? CALENDAR_WEEKS;
  const totalDays = weeks * 7;
  // Align the window to whole Monday-first weeks: it opens on the Monday of the
  // week `weeks - 1` weeks before the current one and closes on the current
  // week's Sunday, so grouping always yields exactly `weeks` complete rows.
  const todayWeekday = new Date(`${input.today}T00:00:00Z`).getUTCDay();
  const weekdayIndex = todayWeekday === 0 ? 6 : todayWeekday - 1; // Monday = 0
  const windowStart = addDaysIso(input.today, -(weekdayIndex + (weeks - 1) * 7));
  type DayBucket = {
    activityMinutes: number;
    attemptMinutes: number;
    activityTests: number;
    attemptTests: number;
    activityQuestions: number;
    attemptQuestions: number;
    scores: number[];
  };
  const byDate = new Map<string, DayBucket>();

  const bucket = (date: string) => {
    const existing = byDate.get(date);
    if (existing) return existing;
    const created: DayBucket = {
      activityMinutes: 0,
      attemptMinutes: 0,
      activityTests: 0,
      attemptTests: 0,
      activityQuestions: 0,
      attemptQuestions: 0,
      scores: [],
    };
    byDate.set(date, created);
    return created;
  };

  input.activity.forEach((row) => {
    if (!row.activity_date || !/^\d{4}-\d{2}-\d{2}$/.test(row.activity_date)) return;
    const entry = bucket(row.activity_date);
    entry.activityMinutes += toNumber(row.minutes_studied);
    entry.activityTests += toNumber(row.tests_completed);
    entry.activityQuestions += toNumber(row.questions_attempted);
  });

  completedAttempts(input.attempts).forEach((attempt) => {
    const date = isoDateOf(attempt.submitted_at);
    if (!date) return;
    const entry = bucket(date);
    entry.attemptTests += 1;
    entry.attemptMinutes += toNumber(attempt.time_spent_seconds) / 60;
    entry.attemptQuestions += toNumber(attempt.answered_count);
    const score = clampPercent(attempt.percentage);
    if (score !== null) entry.scores.push(score);
  });

  const days: CalendarDay[] = [];
  for (let offset = 0; offset < totalDays; offset += 1) {
    const date = addDaysIso(windowStart, offset);
    const entry = byDate.get(date);
    // Study-activity rows win when they exist; attempt time is the fallback so
    // the heatmap never double counts the same session.
    const minutes = Math.round(
      entry ? Math.max(entry.activityMinutes, entry.attemptMinutes) : 0
    );
    days.push({
      date,
      minutes,
      tests: entry ? Math.max(entry.activityTests, entry.attemptTests) : 0,
      questions: entry ? Math.max(entry.activityQuestions, entry.attemptQuestions) : 0,
      bestScore: entry?.scores.length ? round1(Math.max(...entry.scores)) : null,
      intensity: intensityForMinutes(minutes),
      isToday: date === input.today,
    });
  }

  return days;
}

/** Groups calendar days into calendar weeks starting on Monday. */
export function groupCalendarWeeks(days: CalendarDay[]): CalendarDay[][] {
  const weeks: CalendarDay[][] = [];
  let current: CalendarDay[] = [];

  days.forEach((day) => {
    const weekday = new Date(`${day.date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
    const index = weekday === 0 ? 6 : weekday - 1;
    if (index === 0 && current.length) {
      weeks.push(current);
      current = [];
    }
    current.push(day);
  });

  if (current.length) weeks.push(current);
  return weeks;
}

// --- Recent activity -------------------------------------------------------

export function buildActivityFeed(input: {
  attempts: RawAttempt[];
  activity: RawActivity[];
  accuracyByAttempt: Map<string, number | null>;
  limit?: number;
}): ActivityItem[] {
  const items: ActivityItem[] = [];
  const attemptDates = new Set<string>();

  sortByRecency(input.attempts).forEach((attempt) => {
    const completed = isCompleted(attempt);
    const date = isoDateOf(attempt.submitted_at ?? attempt.updated_at ?? attempt.started_at);
    if (date) attemptDates.add(date);
    items.push({
      id: `attempt-${attempt.id}`,
      kindKey: "activity.kindTest",
      title: attemptTitle(attempt),
      occurredAt: attempt.submitted_at ?? attempt.updated_at ?? attempt.started_at,
      score: completed ? clampPercent(attempt.percentage) : null,
      accuracy: input.accuracyByAttempt.get(attempt.id) ?? null,
      href: completed ? `/test/result/${attempt.id}` : attempt.slug ? `/test/${attempt.slug}/attempt` : "/mock-tests",
      inProgress: !completed,
    });
  });

  input.activity.forEach((row) => {
    if (!row.activity_date || attemptDates.has(row.activity_date)) return;
    const questions = toNumber(row.questions_attempted);
    if (questions <= 0) return;
    items.push({
      id: `activity-${row.activity_date}`,
      kindKey: "activity.kindPractice",
      title: `${questions} questions practiced`,
      occurredAt: `${row.activity_date}T12:00:00.000Z`,
      score: null,
      accuracy: null,
      href: "/analytics",
      inProgress: false,
    });
  });

  return items
    .sort((a, b) => (Date.parse(b.occurredAt ?? "") || 0) - (Date.parse(a.occurredAt ?? "") || 0))
    .slice(0, input.limit ?? 6);
}

// --- Achievements ----------------------------------------------------------

export function buildAchievementSummary(input: {
  catalog: { id: string; code: string; name: string; description: string | null; xp_reward: number | null }[];
  earned: { achievement_id: string; earned_at: string | null }[];
}): AchievementSummary {
  const earnedById = new Map(input.earned.map((row) => [row.achievement_id, row.earned_at ?? null]));

  const items = input.catalog
    .map((achievement) => ({
      id: achievement.id,
      code: achievement.code,
      name: achievement.name,
      description: achievement.description,
      xpReward: achievement.xp_reward ?? 0,
      earnedAt: earnedById.get(achievement.id) ?? null,
      unlocked: earnedById.has(achievement.id),
    }))
    .sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      if (a.unlocked && b.unlocked) {
        return (Date.parse(b.earnedAt ?? "") || 0) - (Date.parse(a.earnedAt ?? "") || 0);
      }
      return a.xpReward - b.xpReward;
    });

  const unlocked = items.filter((item) => item.unlocked).length;

  return {
    unlocked,
    total: items.length,
    items,
    percent: items.length ? Math.round((unlocked / items.length) * 100) : 0,
  };
}

// --- Level / XP ------------------------------------------------------------

/**
 * XP is stored on the server (`profiles.total_xp`) and is protected by a
 * database trigger, so this only *presents* the stored value. Until the rewards
 * engine starts writing transactions, `available` stays false and the UI shows
 * an explanation instead of a made-up number.
 */
export function buildLevelProgress(xp: number | null | undefined): LevelProgress {
  const safeXp = Math.max(0, Math.round(toNumber(xp)));
  const level = getLevelFromXP(safeXp);
  const nextLevelXp = getXPForNextLevel(level);
  const previousLevelXp = level > 1 ? getXPForNextLevel(level - 1) : 0;
  const span = nextLevelXp - previousLevelXp;
  const progressed = safeXp - previousLevelXp;

  return {
    xp: safeXp,
    level,
    nextLevelXp,
    percent: span > 0 ? clamp(Math.round((progressed / span) * 100), 0, 100) : 0,
    available: safeXp > 0,
  };
}

// --- Continue where you left off ------------------------------------------

export function buildContinuation(attempts: RawAttempt[]): Continuation | null {
  const open = attempts
    .filter((attempt) => attempt.status === "in_progress")
    .sort((a, b) => {
      const left = Date.parse(a.updated_at ?? a.started_at ?? "") || 0;
      const right = Date.parse(b.updated_at ?? b.started_at ?? "") || 0;
      return right - left;
    });

  const attempt = open[0];
  if (!attempt) return null;

  const answered = toNumber(attempt.answered_count);
  const total = toNumber(attempt.total_questions);

  return {
    attemptId: attempt.id,
    title: attemptTitle(attempt),
    slug: attempt.slug,
    answered,
    total,
    percent: total > 0 ? clamp(Math.round((answered / total) * 100), 0, 100) : 0,
    startedIso: attempt.started_at,
    lastActiveIso: attempt.updated_at ?? attempt.started_at,
    href: attempt.slug ? `/test/${attempt.slug}/attempt` : "/mock-tests",
  };
}

// --- AI study insight (explains verified numbers, never computes them) -----

export type InsightInput = {
  performance: PerformanceSummary;
  subjects: SlicePerformance[];
  weakAreas: WeakArea[];
  recommendations: Recommendation[];
  wrongAnswersTotal: number;
};

export function buildStudyInsight(input: InsightInput): StudyInsight {
  const testsCompleted = input.performance.testsCompleted;
  const practiceHref = input.weakAreas[0]?.practiceHref ?? input.recommendations[0]?.href ?? null;

  if (testsCompleted === 0) {
    return {
      available: false,
      findings: [],
      nextStep: { key: "insight.nextStepTest" },
      practiceHref: null,
    };
  }

  const findings: InsightFinding[] = [];

  const strongest = input.subjects
    .filter((subject) => !subject.lowSample)
    .sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0))[0];
  if (strongest && (strongest.accuracy ?? 0) >= STRONG_AREA_MIN_ACCURACY) {
    findings.push({ key: "insight.strength", params: { subject: strongest.name } });
  }

  const weakNames = input.weakAreas.slice(0, 2).map((area) => area.name);
  if (weakNames.length) {
    findings.push({ key: "insight.weakness", params: { topics: weakNames.join(" & ") } });
  }

  const scores = input.performance.series.map((point) => point.score);
  if (scores.length >= 4) {
    const middle = Math.floor(scores.length / 2);
    const older = average(scores.slice(0, middle));
    const newer = average(scores.slice(middle));
    if (older !== null && newer !== null) {
      const from = round1(older);
      const to = round1(newer);
      if (to - from >= 3) findings.push({ key: "insight.improving", params: { from, to } });
      else if (from - to >= 3) findings.push({ key: "insight.slipping", params: { from, to } });
    }
  }

  if (testsCompleted < 3) {
    findings.push({ key: "insight.lowSample", params: { count: testsCompleted } });
  }

  let nextStep: InsightFinding;
  if (input.weakAreas[0]) {
    nextStep = {
      key: "insight.nextStepPractice",
      params: {
        count: input.recommendations[0]?.suggestedQuestions ?? MIN_SAMPLES.topic,
        topic: input.weakAreas[0].name,
      },
    };
  } else if (input.wrongAnswersTotal >= 10) {
    nextStep = { key: "insight.nextStepRevise", params: { count: input.wrongAnswersTotal } };
  } else {
    nextStep = { key: "insight.nextStepTest" };
  }

  return { available: true, findings, nextStep, practiceHref };
}

// --- New-student onboarding ------------------------------------------------

export function buildOnboarding(input: {
  hasBoard: boolean;
  hasClass: boolean;
  testsCompleted: number;
  analysisUnlocked: boolean;
  recommendationCount: number;
}): { isNewStudent: boolean; done: number; total: number; steps: OnboardingStep[] } {
  const analysisHref = input.testsCompleted > 0 ? "/analytics" : "/mock-tests";
  const steps: OnboardingStep[] = [
    {
      id: "exam-setup",
      labelKey: "onboarding.step1",
      doneKey: "onboarding.step1Done",
      done: input.hasBoard && input.hasClass,
      href: "/settings",
    },
    {
      id: "first-test",
      labelKey: "onboarding.step2",
      doneKey: "onboarding.step2Done",
      done: input.testsCompleted > 0,
      href: "/mock-tests",
    },
    {
      id: "analysis",
      labelKey: "onboarding.step3",
      doneKey: "onboarding.step3Done",
      done: input.analysisUnlocked,
      href: analysisHref,
    },
    {
      id: "practice",
      labelKey: "onboarding.step4",
      doneKey: "onboarding.step4Done",
      done: input.recommendationCount > 0,
      href: input.recommendationCount > 0 ? null : "/mock-tests",
    },
  ];

  return {
    isNewStudent: input.testsCompleted === 0,
    done: steps.filter((step) => step.done).length,
    total: steps.length,
    steps,
  };
}

// --- Practice links --------------------------------------------------------

/**
 * Practice links only point at routes that exist today:
 *   - a topic   -> the mock-test catalogue filtered by the topic name
 *   - a subject -> the Learn browser filtered by the subject slug
 */
export function topicPracticeHref(name: string): string {
  return `/mock-tests?search=${encodeURIComponent(name)}`;
}

export function subjectPracticeHref(subject: { name: string; slug: string | null }): string {
  return subject.slug
    ? `/learn?subjectSlug=${encodeURIComponent(subject.slug)}`
    : `/mock-tests?search=${encodeURIComponent(subject.name)}`;
}

// --- Assembler -------------------------------------------------------------

export type DashboardBuildInput = {
  now?: Date;
  attempts: RawAttempt[];
  /** Per-question rows; only completed attempts are used. */
  responses: RawResponse[];
  questionMeta: Map<string, QuestionMeta>;
  topics: TopicRef[];
  subjects: SubjectRef[];
  activity: RawActivity[];
  achievementsCatalog: { id: string; code: string; name: string; description: string | null; xp_reward: number | null }[];
  earnedAchievements: { achievement_id: string; earned_at: string | null }[];
  leaderboard: { entries: LeaderboardEntry[]; currentUser: LeaderboardEntry | null };
  studyPlan: StudyPlanView | null;
  profile: {
    total_xp: number | null;
    daily_goal_minutes: number | null;
    board_id: string | null;
    class_id: string | null;
  };
  /** Stays false until a challenge engine is wired to the dashboard. */
  dailyChallengeAvailable?: boolean;
};

/** Turns raw rows into the whole dashboard view model. Pure and testable. */
export function buildDashboardData(input: DashboardBuildInput): DashboardData {
  const today = todayIso(input.now ?? new Date());
  const completed = completedAttempts(input.attempts);
  const completedIds = new Set(completed.map((attempt) => attempt.id));
  const responses = input.responses.filter((response) => completedIds.has(response.attempt_id));

  const attemptTimes = new Map(completed.map((attempt) => [attempt.id, attempt.submitted_at]));
  const attemptById = new Map(completed.map((attempt) => [attempt.id, attempt]));
  const groupedResponses = groupResponsesByAttempt(responses);
  const accuracyByAttempt = new Map<string, number | null>(
    [...groupedResponses.entries()].map(([attemptId, rows]) => [attemptId, attemptAccuracy(rows)])
  );

  const performance = buildPerformance(input.attempts, responses);

  const streak = buildStreak({
    activityDates: input.activity.map((row) => row.activity_date),
    attemptDates: completed.map((attempt) => isoDateOf(attempt.submitted_at)),
    today,
  });

  const todayAttempts = completed.filter((attempt) => isoDateOf(attempt.submitted_at) === today);
  const todayActivity = input.activity.find((row) => row.activity_date === today) ?? null;

  const todayGoal = buildTodayGoal({
    today,
    todayAttempts,
    todayActivity,
    goalQuestions: GOAL_DEFAULTS.questions,
    goalMinutes:
      input.profile.daily_goal_minutes && input.profile.daily_goal_minutes > 0
        ? input.profile.daily_goal_minutes
        : GOAL_DEFAULTS.studyMinutes,
    dailyChallengeAvailable: input.dailyChallengeAvailable,
  });

  const topicSlices = buildSlicePerformance({
    responses,
    questionMeta: input.questionMeta,
    refs: input.topics,
    attemptTimes,
    kind: "topic",
    minSample: MIN_SAMPLES.topic,
    hrefFor: (slice) => topicPracticeHref(slice.name),
  });

  const subjectSlices = buildSlicePerformance({
    responses,
    questionMeta: input.questionMeta,
    refs: input.subjects,
    attemptTimes,
    kind: "subject",
    minSample: MIN_SAMPLES.subject,
    hrefFor: (slice) => subjectPracticeHref(slice),
  });

  const weakAreas = selectWeakAreas(topicSlices);

  // Recent mistakes drive the "due for revision" recommendation rule.
  const recentAttemptIds = sortByRecency(completed).slice(0, 3).map((attempt) => attempt.id);
  const recentWrongTopicIds = [
    ...new Set(
      responses
        .filter((response) => response.is_correct === false && recentAttemptIds.includes(response.attempt_id))
        .map((response) => input.questionMeta.get(response.question_id)?.topic_id ?? null)
        .filter((value): value is string => Boolean(value))
    ),
  ];

  const sliceTotals = new Map<string, { seconds: number; count: number }>();
  responses.forEach((response) => {
    if (response.is_correct === null) return;
    const meta = input.questionMeta.get(response.question_id);
    if (!meta) return;
    [meta.topic_id, meta.subject_id].forEach((sliceId) => {
      if (!sliceId) return;
      const totals = sliceTotals.get(sliceId) ?? { seconds: 0, count: 0 };
      totals.seconds += Math.max(0, response.time_spent_seconds ?? 0);
      totals.count += 1;
      sliceTotals.set(sliceId, totals);
    });
  });
  const secondsPerSlice = new Map<string, number>();
  sliceTotals.forEach((totals, sliceId) => {
    if (totals.count > 0 && totals.seconds > 0) secondsPerSlice.set(sliceId, totals.seconds / totals.count);
  });

  const answeredResponses = responses.filter((response) => response.is_correct !== null);
  const fallbackSeconds = answeredResponses.length
    ? answeredResponses.reduce((sum, response) => sum + Math.max(0, response.time_spent_seconds ?? 0), 0) /
      answeredResponses.length
    : null;

  const recommendations = buildRecommendations({
    topics: topicSlices,
    subjects: subjectSlices,
    recentWrongTopicIds,
    secondsPerSlice,
    fallbackSeconds,
  });

  const topicNameById = new Map(input.topics.map((topic) => [topic.id, topic.name]));
  const wrongAnswers = buildWrongAnswers({
    responses,
    questionMeta: input.questionMeta,
    attemptById,
    topicNameById,
    limit: 5,
  });

  const calendar = buildCalendar({
    activity: input.activity,
    attempts: input.attempts,
    today,
    weeks: CALENDAR_WEEKS,
  });

  const activityFeed = buildActivityFeed({
    attempts: input.attempts,
    activity: input.activity,
    accuracyByAttempt,
    limit: 6,
  });

  const achievements = buildAchievementSummary({
    catalog: input.achievementsCatalog,
    earned: input.earnedAchievements,
  });

  const level = buildLevelProgress(input.profile.total_xp);

  const insight = buildStudyInsight({
    performance,
    subjects: subjectSlices,
    weakAreas,
    recommendations,
    wrongAnswersTotal: wrongAnswers.total,
  });

  const analysisUnlocked =
    topicSlices.some((slice) => !slice.lowSample) || subjectSlices.some((slice) => !slice.lowSample);

  const onboarding = buildOnboarding({
    hasBoard: Boolean(input.profile.board_id),
    hasClass: Boolean(input.profile.class_id),
    testsCompleted: performance.testsCompleted,
    analysisUnlocked,
    recommendationCount: recommendations.length,
  });

  return {
    performance,
    streak,
    todayGoal,
    // Display order: strongest first for mastery; the weak list is built before sorting.
    subjects: [...subjectSlices].sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0)),
    topics: [...topicSlices].sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0)),
    weakAreas,
    recommendations,
    wrongAnswers,
    continuation: buildContinuation(input.attempts),
    calendar,
    activity: activityFeed,
    achievements,
    level,
    insight,
    leaderboard: input.leaderboard,
    studyPlan: input.studyPlan,
    onboarding,
  };
}







