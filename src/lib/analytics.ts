/**
 * Pure view-model helpers for the student analytics screens.
 *
 * These functions only reshape rows that already exist in the database.
 * They never invent data, so every number shown in the UI is traceable to a
 * real test attempt or study-activity record.
 */

export type AttemptRow = {
  id: string;
  percentage: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  skipped_count: number | null;
  time_spent_seconds: number | null;
  submitted_at: string | null;
  title?: string | null;
};

export type ActivityRow = {
  activity_date: string | null;
  minutes_studied: number | null;
};

export type AttemptPoint = {
  id: string;
  label: string;
  title: string;
  score: number;
  correct: number;
  incorrect: number;
  skipped: number;
  minutes: number;
};

export type StudyPoint = {
  key: string;
  label: string;
  minutes: number;
};

export type AnalyticsSummary = {
  testsCompleted: number;
  averageScore: number;
  bestScore: number;
  accuracy: number;
  questionsAnswered: number;
  questionsCorrect: number;
  totalMinutes: number;
  scoreDelta: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function clampScore(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function toNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Stable short label for a date, used on chart axes. */
export function formatDayLabel(iso: string | null | undefined) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Long label used in tooltips and screen-reader summaries. */
export function formatFullLabel(iso: string | null | undefined) {
  if (!iso) return "Date unavailable";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function getAttemptTitle(attempt: { title?: string | null }) {
  return attempt.title?.trim() || "Mock test";
}

/**
 * Oldest-to-newest series of the most recent attempts, ready for charting.
 * `rows` are expected newest-first (as they come back from the database).
 */
export function buildAttemptSeries(rows: AttemptRow[], limit = 12): AttemptPoint[] {
  return [...rows]
    .filter((row) => typeof row.percentage === "number")
    .sort((a, b) => {
      // Sort newest first, then flip, so the chart always reads left-to-right
      // in chronological order regardless of the order rows arrive in.
      const left = a.submitted_at ? Date.parse(a.submitted_at) : 0;
      const right = b.submitted_at ? Date.parse(b.submitted_at) : 0;
      if (Number.isNaN(left)) return 1;
      if (Number.isNaN(right)) return -1;
      return right - left;
    })
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      label: formatDayLabel(row.submitted_at),
      title: getAttemptTitle(row),
      score: Math.round(clampScore(row.percentage) * 10) / 10,
      correct: toNumber(row.correct_count),
      incorrect: toNumber(row.wrong_count),
      skipped: toNumber(row.skipped_count),
      minutes: Math.round(toNumber(row.time_spent_seconds) / 60),
    }))
    .reverse();
}

export function buildSummary(rows: AttemptRow[], activity: ActivityRow[] = []): AnalyticsSummary {
  const scored = rows.filter((row) => typeof row.percentage === "number");
  const scores = scored.map((row) => clampScore(row.percentage));

  const questionsCorrect = rows.reduce((sum, row) => sum + toNumber(row.correct_count), 0);
  const questionsIncorrect = rows.reduce((sum, row) => sum + toNumber(row.wrong_count), 0);
  const questionsAnswered = questionsCorrect + questionsIncorrect;

  const attemptMinutes = rows.reduce(
    (sum, row) => sum + toNumber(row.time_spent_seconds) / 60,
    0
  );
  const activityMinutes = activity.reduce((sum, row) => sum + toNumber(row.minutes_studied), 0);
  const totalMinutes = Math.round(activityMinutes > 0 ? activityMinutes : attemptMinutes);

  const averageScore = scores.length
    ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10
    : 0;

  const latest = scores[0] ?? null;
  const previous = scores[1] ?? null;

  return {
    testsCompleted: rows.length,
    averageScore,
    bestScore: scores.length ? Math.max(...scores) : 0,
    accuracy: questionsAnswered
      ? Math.round((questionsCorrect / questionsAnswered) * 1000) / 10
      : 0,
    questionsAnswered,
    questionsCorrect,
    totalMinutes,
    scoreDelta: latest !== null && previous !== null ? Math.round((latest - previous) * 10) / 10 : null,
  };
}

/** Correct / incorrect / unanswered totals across every attempt. */
export function buildOutcomeSplit(rows: AttemptRow[]) {
  return {
    correct: rows.reduce((sum, row) => sum + toNumber(row.correct_count), 0),
    incorrect: rows.reduce((sum, row) => sum + toNumber(row.wrong_count), 0),
    skipped: rows.reduce((sum, row) => sum + toNumber(row.skipped_count), 0),
  };
}

/**
 * Daily study minutes for the last `days` days, oldest first.
 * Falls back to per-attempt time when no study-activity rows exist.
 */
export function buildStudySeries(
  activity: ActivityRow[],
  attempts: AttemptRow[] = [],
  days = 7,
  now: Date = new Date()
): StudyPoint[] {
  const byDay = new Map<string, number>();
  const hasActivity = activity.length > 0;

  if (hasActivity) {
    activity.forEach((row) => {
      if (!row.activity_date) return;
      const key = row.activity_date.slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + toNumber(row.minutes_studied));
    });
  } else {
    attempts.forEach((row) => {
      if (!row.submitted_at) return;
      const key = row.submitted_at.slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + toNumber(row.time_spent_seconds) / 60);
    });
  }

  const series: StudyPoint[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(now.getTime() - offset * DAY_MS);
    const key = day.toISOString().slice(0, 10);
    const minutes = Math.round(byDay.get(key) ?? 0);
    series.push({
      key,
      label: day.toLocaleDateString("en-IN", { weekday: "short" }),
      minutes,
    });
  }

  return series;
}

/** Human sentence describing the trend, or null when there is not enough data. */
export function describeTrend(delta: number | null) {
  if (delta === null) return null;
  if (delta > 0) return `Up ${Math.abs(delta)} points versus your previous test.`;
  if (delta < 0) return `Down ${Math.abs(delta)} points versus your previous test.`;
  return "Level with your previous test.";
}