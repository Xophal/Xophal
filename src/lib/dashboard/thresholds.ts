import type { TextKey } from "@/lib/i18n";

/**
 * Deterministic thresholds for every judgement the dashboard makes.
 *
 * Nothing in the student dashboard may invent a statistic, and nothing may
 * label a student either. Mastery bands, weak-area rules and the level curve
 * are declared once here so the UI and the tests agree on the same numbers.
 */

export const APP_TIME_ZONE = "Asia/Kolkata";

export type MasteryBandCode = "strong" | "good" | "improving" | "needsPractice" | "insufficient";

export type MasteryBand = {
  code: MasteryBandCode;
  /** Inclusive lower bound of accuracy (%). */
  min: number;
  labelKey: TextKey;
  /** Tailwind-ish tone token used by the presentation layer. */
  tone: "emerald" | "sky" | "amber" | "rose" | "slate";
};

/** Ordered from strongest to weakest; the first match wins. */
export const MASTERY_BANDS: MasteryBand[] = [
  { code: "strong", min: 85, labelKey: "mastery.band.strong", tone: "emerald" },
  { code: "good", min: 70, labelKey: "mastery.band.good", tone: "sky" },
  { code: "improving", min: 55, labelKey: "mastery.band.improving", tone: "amber" },
  { code: "needsPractice", min: 0, labelKey: "mastery.band.needsPractice", tone: "rose" },
];

/** Shown instead of a band while the sample is too small to be meaningful. */
export const INSUFFICIENT_BAND: MasteryBand = {
  code: "insufficient",
  min: 0,
  labelKey: "mastery.band.insufficient",
  tone: "slate",
};

/**
 * Minimum answered questions before the dashboard is willing to judge a slice
 * of performance. Below these numbers the UI shows the raw counts and says the
 * sample is small instead of guessing a level.
 */
export const MIN_SAMPLES = {
  /** Per topic. */
  topic: 8,
  /** Per subject. */
  subject: 5,
  /** Before a topic may be called a weak area. */
  weakArea: 10,
} as const;

/** A weak area must be under this accuracy. */
export const WEAK_AREA_MAX_ACCURACY = 60;

/** A strong area must be at or above this accuracy. */
export const STRONG_AREA_MIN_ACCURACY = 80;

/** Daily goal defaults; `profiles.daily_goal_minutes` overrides the minutes. */
export const GOAL_DEFAULTS = {
  questions: 20,
  studyMinutes: 30,
  tests: 1,
} as const;

/** Suggested practice session size. Derived, never random. */
export const SESSION_SIZE = {
  min: 10,
  max: 20,
  /** Points added to the size of a topic that is being missed often. */
  weakBonus: 5,
} as const;

/** Minutes of activity that make a day count towards a streak. */
export const STREAK_MIN_QUALIFYING_MINUTES = 5;

/** Days shown in the study calendar heatmap (5 full weeks + the current one). */
export const CALENDAR_WEEKS = 5;

/** How many recent attempts are used for per-question analytics. */
export const RESPONSE_ANALYSIS_ATTEMPTS = 10;

/** Points after which the dashboard stops pulling more history. */
export const ATTEMPT_HISTORY_LIMIT = 50;

export const SCORE_TREND_POINTS = 12;

/** Accuracy of the very first attempt of a slice, used to describe a trend. */
export const TREND_DELTA_POINTS = 5;

export function masteryBand(accuracy: number | null, sample: number, minSample: number): MasteryBand {
  if (accuracy === null || sample < minSample) return INSUFFICIENT_BAND;
  return MASTERY_BANDS.find((band) => accuracy >= band.min) ?? INSUFFICIENT_BAND;
}

export function isWeakArea(accuracy: number | null, sample: number): boolean {
  if (accuracy === null || sample < MIN_SAMPLES.weakArea) return false;
  return accuracy < WEAK_AREA_MAX_ACCURACY;
}

/**
 * Suggested number of questions for a practice session on one topic.
 * Grows with how often the topic has been missed, then is clamped so a
 * recommendation never turns into a two-hour marathon.
 */
export function suggestedSessionSize(input: { attempted: number; accuracy: number | null; wrongCount: number }): number {
  const base = Math.max(SESSION_SIZE.min, Math.min(SESSION_SIZE.max, Math.round(input.attempted)));
  const struggling = input.accuracy !== null && input.accuracy < WEAK_AREA_MAX_ACCURACY;
  const bonus = struggling && input.wrongCount > 0 ? SESSION_SIZE.weakBonus : 0;
  return Math.max(SESSION_SIZE.min, Math.min(SESSION_SIZE.max, base + bonus));
}
