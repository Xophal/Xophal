/**
 * Server-only dashboard data loading.
 *
 * This module is server-only by convention (the repo does not use the
 * `server-only` package because Vitest cannot import it). It must never be
 * imported from a client component: it reads with the service-role client.
 *
 * Performance rules followed here:
 *   - One bounded attempt window (`ATTEMPT_HISTORY_LIMIT`), never a full scan.
 *   - Per-question analytics only for the most recent `RESPONSE_ANALYSIS_ATTEMPTS`
 *     attempts, so a student with 500 attempts does not pull 25 000 answers.
 *   - Column lists are explicit; nothing sensitive leaves the server.
 *   - `questions` is admin-only in RLS, so the row metadata needed for topic and
 *     subject breakdowns is read with the service-role client *scoped to the
 *     question ids this user actually answered*. No other user's data is read,
 *     and no answer key is exposed to the browser.
 *   - Dimension tables (topics/subjects/difficulty) are fetched only for the ids
 *     that appear in the user's own answers.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ATTEMPT_HISTORY_LIMIT, CALENDAR_WEEKS, RESPONSE_ANALYSIS_ATTEMPTS } from "./thresholds";
import { addDaysIso, buildDashboardData, todayIso } from "./metrics";
import type {
  DashboardData,
  LeaderboardEntry,
  QuestionMeta,
  RawActivity,
  RawAttempt,
  RawResponse,
  StudyPlanView,
  SubjectRef,
  TopicRef,
} from "./types";

/**
 * Server-only dashboard data loading.
 *
 * Performance rules followed here:
 *   - One bounded attempt window (`ATTEMPT_HISTORY_LIMIT`), never a full scan.
 *   - Per-question analytics only for the most recent `RESPONSE_ANALYSIS_ATTEMPTS`
 *     attempts, so a student with 500 attempts does not pull 25 000 answers.
 *   - Column lists are explicit; nothing sensitive leaves the server.
 *   - `questions` is admin-only in RLS, so the row metadata needed for topic and
 *     subject breakdowns is read with the service-role client *scoped to the
 *     question ids this user actually answered*. No other user's data is read,
 *     and no answer key is fetched.
 *   - Dimension tables (topics/subjects/difficulty) are fetched only for the ids
 *     that appear in the user's own answers.
 */

export const LEADERBOARD_PERIODS = ["weekly", "monthly", "global", "exam"] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

export function resolveLeaderboardPeriod(value: unknown): LeaderboardPeriod {
  return typeof value === "string" && (LEADERBOARD_PERIODS as readonly string[]).includes(value)
    ? (value as LeaderboardPeriod)
    : "weekly";
}

export type DashboardProfile = {
  id: string;
  full_name: string | null;
  total_xp: number | null;
  daily_goal_minutes: number | null;
  board_id: string | null;
  class_id: string | null;
};

export type DashboardLoadOptions = {
  now?: Date;
  leaderboardPeriod?: LeaderboardPeriod;
  /** Not wired to a challenge engine yet, so the goal task stays honest. */
  dailyChallengeAvailable?: boolean;
};

const QUESTION_CHUNK_SIZE = 80;

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function selectInChunks<T>(
  ids: string[],
  fetch: (chunk: string[]) => Promise<T[]>
): Promise<T[]> {
  const results: T[] = [];
  for (let index = 0; index < ids.length; index += QUESTION_CHUNK_SIZE) {
    const chunk = ids.slice(index, index + QUESTION_CHUNK_SIZE);
    if (!chunk.length) continue;
    results.push(...(await fetch(chunk)));
  }
  return results;
}

type MockTestRelation = { id?: string; title?: string | null; slug?: string | null };

type AttemptQueryRow = {
  id: string;
  mock_test_id: string;
  status: string | null;
  started_at: string | null;
  updated_at: string | null;
  submitted_at: string | null;
  percentage: number | string | null;
  answered_count: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  skipped_count: number | null;
  total_questions: number | null;
  time_spent_seconds: number | null;
  mock_tests: MockTestRelation | MockTestRelation[] | null;
};

function toNumberOrNull(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapAttempt(row: AttemptQueryRow): RawAttempt {
  const test = firstRelation(row.mock_tests);
  return {
    id: row.id,
    mock_test_id: row.mock_test_id,
    title: test?.title ?? null,
    slug: test?.slug ?? null,
    status: row.status ?? "submitted",
    started_at: row.started_at,
    updated_at: row.updated_at,
    submitted_at: row.submitted_at,
    percentage: toNumberOrNull(row.percentage),
    answered_count: row.answered_count,
    correct_count: row.correct_count,
    wrong_count: row.wrong_count,
    skipped_count: row.skipped_count,
    total_questions: row.total_questions,
    time_spent_seconds: row.time_spent_seconds,
  };
}

// --- Individual datasets ---------------------------------------------------

async function loadAttempts(supabase: SupabaseClient, userId: string): Promise<RawAttempt[]> {
  const { data, error } = await supabase
    .from("test_attempts")
    .select(
      "id, mock_test_id, status, started_at, updated_at, submitted_at, percentage, answered_count, correct_count, wrong_count, skipped_count, total_questions, time_spent_seconds, mock_tests(id, title, slug)"
    )
    .eq("user_id", userId)
    .in("status", ["in_progress", "submitted", "expired"])
    .order("started_at", { ascending: false })
    .limit(ATTEMPT_HISTORY_LIMIT);

  if (error) throw error;
  return ((data ?? []) as unknown as AttemptQueryRow[]).map(mapAttempt);
}

async function loadActivity(supabase: SupabaseClient, userId: string, today: string): Promise<RawActivity[]> {
  const { data, error } = await supabase
    .from("user_daily_activity")
    .select("activity_date, minutes_studied, questions_attempted, tests_completed")
    .eq("user_id", userId)
    .gte("activity_date", addDaysIso(today, -(CALENDAR_WEEKS * 7)))
    .order("activity_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as RawActivity[];
}

async function loadResponseRows(supabase: SupabaseClient, attemptIds: string[]): Promise<RawResponse[]> {
  if (!attemptIds.length) return [];
  const { data, error } = await supabase
    .from("test_responses")
    .select("attempt_id, question_id, is_correct, time_spent_seconds")
    .in("attempt_id", attemptIds);

  if (error) throw error;
  return (data ?? []) as unknown as RawResponse[];
}

async function loadQuestionMeta(
  admin: SupabaseClient,
  questionIds: string[],
  difficultyNames: Map<string, string>
): Promise<QuestionMeta[]> {
  if (!questionIds.length) return [];

  const rows = await selectInChunks(questionIds, async (chunk) => {
    const { data, error } = await admin
      .from("questions")
      .select("id, topic_id, subject_id, difficulty_level_id, explanation, question_text")
      .in("id", chunk);
    if (error) throw error;
    return (data ?? []) as unknown as {
      id: string;
      topic_id: string | null;
      subject_id: string | null;
      difficulty_level_id: string | null;
      explanation: string | null;
      question_text: string | null;
    }[];
  });

  return rows.map((row) => ({
    id: row.id,
    topic_id: row.topic_id,
    subject_id: row.subject_id,
    difficulty_name: row.difficulty_level_id ? difficultyNames.get(row.difficulty_level_id) ?? null : null,
    has_explanation: Boolean(row.explanation && row.explanation.trim().length > 0),
    question_text: row.question_text,
  }));
}

async function loadDimensions(
  supabase: SupabaseClient,
  topicIds: string[],
  subjectIds: string[]
): Promise<{ topics: TopicRef[]; subjects: SubjectRef[] }> {
  const topics = await selectInChunks(topicIds, async (chunk) => {
    const { data, error } = await supabase.from("topics").select("id, name, slug").in("id", chunk);
    if (error) throw error;
    return (data ?? []) as unknown as TopicRef[];
  });

  const subjects = await selectInChunks(subjectIds, async (chunk) => {
    const { data, error } = await supabase.from("subjects").select("id, name, slug").in("id", chunk);
    if (error) throw error;
    return (data ?? []) as unknown as SubjectRef[];
  });

  return { topics, subjects };
}

/** `difficulty_levels` is a four-row reference table, so it is read whole. */
async function loadDifficultyNames(admin: SupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await admin.from("difficulty_levels").select("id, name");
  if (error) throw error;
  return new Map(((data ?? []) as unknown as { id: string; name: string }[]).map((row) => [row.id, row.name]));
}

async function loadAchievements(supabase: SupabaseClient, userId: string) {
  const [catalogResult, earnedResult] = await Promise.all([
    supabase
      .from("achievements")
      .select("id, code, name, description, xp_reward")
      .eq("is_active", true)
      .order("xp_reward", { ascending: true }),
    supabase.from("user_achievements").select("achievement_id, earned_at").eq("user_id", userId),
  ]);

  if (catalogResult.error) throw catalogResult.error;
  if (earnedResult.error) throw earnedResult.error;

  return {
    catalog: (catalogResult.data ?? []) as unknown as {
      id: string;
      code: string;
      name: string;
      description: string | null;
      xp_reward: number | null;
    }[],
    earned: (earnedResult.data ?? []) as unknown as { achievement_id: string; earned_at: string | null }[],
  };
}

/**
 * Reads stored leaderboard entries for one period. `profiles` is RLS-scoped to
 * the signed-in user, so other students' names are often unavailable — the UI
 * then shows a neutral label instead of inventing one.
 */
async function loadLeaderboard(
  supabase: SupabaseClient,
  userId: string,
  period: LeaderboardPeriod
): Promise<{ entries: LeaderboardEntry[]; currentUser: LeaderboardEntry | null }> {
  const { data, error } = await supabase
    .from("leaderboard_entries")
    .select("rank, total_xp, tests_completed, user_id, profiles(full_name)")
    .eq("period", period)
    .order("rank", { ascending: true })
    .limit(5);

  if (error) throw error;

  const rows = (data ?? []) as unknown as {
    rank: number | null;
    total_xp: number | null;
    tests_completed: number | null;
    user_id: string;
    profiles: { full_name?: string | null } | { full_name?: string | null }[] | null;
  }[];

  const entries: LeaderboardEntry[] = rows
    .filter((row) => typeof row.rank === "number" && row.rank > 0)
    .map((row) => ({
      rank: row.rank as number,
      userId: row.user_id,
      name: firstRelation(row.profiles)?.full_name?.trim() || "",
      xp: row.total_xp ?? 0,
      testsCompleted: row.tests_completed ?? 0,
      isCurrentUser: row.user_id === userId,
    }));

  return { entries, currentUser: entries.find((entry) => entry.isCurrentUser) ?? null };
}

type PlanDay = { day?: string; theme?: string; focus?: string; durationMinutes?: number };

/** Reads the stored plan. Completion tracking is not implemented, so nothing is marked done. */
async function loadStudyPlan(supabase: SupabaseClient, userId: string, today: string): Promise<StudyPlanView | null> {
  const { data, error } = await supabase
    .from("ai_study_plans")
    .select("id, title, plan_data, start_date, end_date")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const plan = data as unknown as {
    id: string;
    title: string;
    start_date: string | null;
    end_date: string | null;
    plan_data: { days?: PlanDay[] } | null;
  };

  const days = Array.isArray(plan.plan_data?.days) ? plan.plan_data?.days ?? [] : [];
  const startDate = plan.start_date ? plan.start_date.slice(0, 10) : null;
  const dayIndex = startDate
    ? Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / (24 * 60 * 60 * 1000))
    : -1;

  return {
    id: plan.id,
    title: plan.title,
    startDate,
    endDate: plan.end_date ? plan.end_date.slice(0, 10) : null,
    // The planner route persists a deterministic plan (no model call today), so
    // the UI must not call it AI-generated.
    sourceKey: "plan.sourceStored",
    tasks: days.slice(0, 7).map((day, index) => ({
      id: `${plan.id}-${index}`,
      label: [day.theme, day.focus].filter(Boolean).join(" · ") || `Day ${index + 1}`,
      done: false,
      dueDate: startDate ? addDaysIso(startDate, index) : null,
      isToday: index === dayIndex,
    })),
  };
}

// --- Main loader -----------------------------------------------------------

/**
 * Loads everything the dashboard needs for one student in a single pass.
 *
 * Two phases only: Phase 1 fetches independent datasets in parallel; phase 2
 * fetches the per-question metadata for the responses phase 1 returned. The
 * route therefore costs a fixed number of round trips regardless of history
 * size, and nothing is fetched that the page does not render.
 */
export async function loadDashboardData(
  profile: DashboardProfile,
  options: DashboardLoadOptions = {}
): Promise<DashboardData> {
  const now = options.now ?? new Date();
  const today = todayIso(now);
  const period = options.leaderboardPeriod ?? "weekly";
  const supabase = await createClient();

  const [attempts, activity, achievements, leaderboard, studyPlan, difficultyNames] = await Promise.all([
    loadAttempts(supabase, profile.id),
    loadActivity(supabase, profile.id, today),
    loadAchievements(supabase, profile.id),
    loadLeaderboard(supabase, profile.id, period),
    loadStudyPlan(supabase, profile.id, today),
    loadDifficultyNamesSafely(),
  ]);

  const completedIds = attempts
    .filter((attempt) => attempt.status === "submitted" || attempt.status === "expired")
    .sort((a, b) => (Date.parse(b.submitted_at ?? "") || 0) - (Date.parse(a.submitted_at ?? "") || 0))
    .slice(0, RESPONSE_ANALYSIS_ATTEMPTS)
    .map((attempt) => attempt.id);

  const responses = await loadResponseRows(supabase, completedIds);

  const questionIds = [...new Set(responses.map((response) => response.question_id))];
  const questionMetaRows = await loadQuestionMetaSafely(questionIds, difficultyNames);
  const questionMeta = new Map(questionMetaRows.map((row) => [row.id, row]));

  const topicIds = [...new Set(questionMetaRows.map((row) => row.topic_id).filter((id): id is string => Boolean(id)))];
  const subjectIds = [
    ...new Set(questionMetaRows.map((row) => row.subject_id).filter((id): id is string => Boolean(id))),
  ];
  const { topics, subjects } = await loadDimensions(supabase, topicIds, subjectIds);

  return buildDashboardData({
    now,
    attempts,
    responses,
    questionMeta,
    topics,
    subjects,
    activity,
    achievementsCatalog: achievements.catalog,
    earnedAchievements: achievements.earned,
    leaderboard,
    studyPlan,
    profile: {
      total_xp: profile.total_xp,
      daily_goal_minutes: profile.daily_goal_minutes,
      board_id: profile.board_id,
      class_id: profile.class_id,
    },
    dailyChallengeAvailable: options.dailyChallengeAvailable,
  });
}

/**
 * Question metadata lives behind an admin-only RLS policy. If the service-role
 * key is not configured, the dashboard degrades to "performance without topic
 * breakdown" instead of failing the whole page.
 */
async function loadQuestionMetaSafely(
  questionIds: string[],
  difficultyNames: Map<string, string>
): Promise<QuestionMeta[]> {
  if (!questionIds.length) return [];
  try {
    const admin = createAdminClient();
    return await loadQuestionMeta(admin, questionIds, difficultyNames);
  } catch (error) {
    console.warn("[dashboard] question metadata unavailable", error instanceof Error ? error.message : error);
    return [];
  }
}

async function loadDifficultyNamesSafely(): Promise<Map<string, string>> {
  try {
    const admin = createAdminClient();
    return await loadDifficultyNames(admin);
  } catch {
    return new Map();
  }
}


