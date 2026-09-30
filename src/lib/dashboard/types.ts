import type { TextKey, TextParams } from "@/lib/i18n";
import type { MasteryBand } from "./thresholds";

/**
 * Input rows (exactly what the database returns) and view models (what the
 * dashboard renders). Keeping both sides typed means the UI can show where
 * every number came from, and the unit tests can pin the deterministic maths.
 */

export type AttemptStatus = "in_progress" | "submitted" | "expired";

export type RawAttempt = {
  id: string;
  mock_test_id: string;
  title: string | null;
  slug: string | null;
  status: string;
  started_at: string | null;
  updated_at: string | null;
  submitted_at: string | null;
  percentage: number | null;
  answered_count: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  skipped_count: number | null;
  total_questions: number | null;
  time_spent_seconds: number | null;
};

export type RawResponse = {
  attempt_id: string;
  question_id: string;
  is_correct: boolean | null;
  time_spent_seconds: number | null;
};

export type RawActivity = {
  activity_date: string;
  minutes_studied: number | null;
  questions_attempted: number | null;
  tests_completed: number | null;
};

/** Metadata joined from `questions` (admin-read, scoped to the user's own answers). */
export type QuestionMeta = {
  id: string;
  topic_id: string | null;
  subject_id: string | null;
  difficulty_name: string | null;
  has_explanation: boolean;
  question_text: string | null;
};

export type TopicRef = { id: string; name: string; slug: string | null };
export type SubjectRef = { id: string; name: string; slug: string | null };

// --- Metrics ---------------------------------------------------------------

export type StreakSummary = {
  current: number;
  longest: number;
  activeToday: boolean;
  hasActivity: boolean;
  /** Real dates that qualified, most recent first. */
  qualifyingDates: string[];
};

export type TrendDirection = "up" | "down" | "flat" | "none";

export type PerformancePoint = {
  id: string;
  label: string;
  title: string;
  score: number;
  accuracy: number | null;
};

export type PerformanceSummary = {
  series: PerformancePoint[];
  testsCompleted: number;
  averageScore: number | null;
  bestScore: number | null;
  accuracy: number | null;
  questionsSolved: number;
  questionsCorrect: number;
  averageMinutes: number | null;
  scoreDelta: number | null;
  accuracyDelta: number | null;
  trend: TrendDirection;
};

export type SlicePerformance = {
  id: string;
  name: string;
  slug: string | null;
  attempted: number;
  correct: number;
  wrong: number;
  accuracy: number | null;
  averageScore: number | null;
  band: MasteryBand;
  trend: TrendDirection;
  lowSample: boolean;
  lastSeenAt: string | null;
  practiceHref: string;
};

export type WeakArea = SlicePerformance & {
  reasonKey: TextKey;
};

export type Recommendation = {
  id: string;
  name: string;
  kind: "topic" | "subject";
  reasonKey: TextKey;
  accuracy: number | null;
  attempted: number;
  suggestedQuestions: number;
  estimatedMinutes: number | null;
  href: string;
};

export type GoalTask = {
  id: string;
  labelKey: TextKey;
  params?: TextParams;
  done: boolean;
  /** False when the data source behind the task does not exist yet. */
  available: boolean;
  noteKey?: TextKey;
};

export type TodayGoal = {
  tasks: GoalTask[];
  completed: number;
  total: number;
  percent: number;
  hasSignal: boolean;
};

export type WrongAnswerItem = {
  attemptId: string;
  questionId: string;
  questionText: string;
  topicName: string | null;
  difficultyName: string | null;
  explanationAvailable: boolean;
  attemptTitle: string;
  submittedAt: string | null;
  attemptHref: string;
  practiceHref: string;
};

export type CalendarDay = {
  date: string;
  minutes: number;
  tests: number;
  questions: number;
  bestScore: number | null;
  intensity: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
};

export type ActivityItem = {
  id: string;
  kindKey: TextKey;
  title: string;
  occurredAt: string | null;
  score: number | null;
  accuracy: number | null;
  href: string | null;
  inProgress: boolean;
};

export type AchievementItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  xpReward: number;
  earnedAt: string | null;
  unlocked: boolean;
};

export type AchievementSummary = {
  unlocked: number;
  total: number;
  items: AchievementItem[];
  percent: number;
};

export type LevelProgress = {
  xp: number;
  level: number;
  nextLevelXp: number;
  percent: number;
  available: boolean;
};

export type Continuation = {
  attemptId: string;
  title: string;
  slug: string | null;
  answered: number;
  total: number;
  percent: number;
  startedIso: string | null;
  lastActiveIso: string | null;
  href: string;
};

export type InsightFinding = { key: TextKey; params?: TextParams };

export type StudyInsight = {
  available: boolean;
  findings: InsightFinding[];
  nextStep: InsightFinding;
  practiceHref: string | null;
};

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  xp: number;
  testsCompleted: number;
  isCurrentUser: boolean;
};

export type StudyPlanTask = {
  id: string;
  label: string;
  done: boolean;
  dueDate: string | null;
  isToday: boolean;
};

export type StudyPlanView = {
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  sourceKey: TextKey;
  tasks: StudyPlanTask[];
};

export type OnboardingStep = {
  id: string;
  labelKey: TextKey;
  doneKey: TextKey;
  done: boolean;
  href: string | null;
};

export type DashboardData = {
  performance: PerformanceSummary;
  streak: StreakSummary;
  todayGoal: TodayGoal;
  subjects: SlicePerformance[];
  topics: SlicePerformance[];
  weakAreas: WeakArea[];
  recommendations: Recommendation[];
  wrongAnswers: { total: number; items: WrongAnswerItem[] };
  continuation: Continuation | null;
  calendar: CalendarDay[];
  activity: ActivityItem[];
  achievements: AchievementSummary;
  level: LevelProgress;
  insight: StudyInsight;
  leaderboard: { entries: LeaderboardEntry[]; currentUser: LeaderboardEntry | null };
  studyPlan: StudyPlanView | null;
  onboarding: { isNewStudent: boolean; done: number; total: number; steps: OnboardingStep[] };
};
