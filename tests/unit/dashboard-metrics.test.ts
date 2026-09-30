import { describe, expect, it } from "vitest";
import {
  buildAchievementSummary,
  buildActivityFeed,
  buildCalendar,
  buildContinuation,
  buildDashboardData,
  buildLevelProgress,
  buildOnboarding,
  buildPerformance,
  buildRecommendations,
  buildSlicePerformance,
  buildStreak,
  buildStudyInsight,
  buildTodayGoal,
  buildWrongAnswers,
  groupCalendarWeeks,
  intensityForMinutes,
  selectWeakAreas,
  subjectPracticeHref,
  topicPracticeHref,
  type DashboardBuildInput,
} from "@/lib/dashboard/metrics";
import { MIN_SAMPLES, masteryBand } from "@/lib/dashboard/thresholds";
import type {
  QuestionMeta,
  RawActivity,
  RawAttempt,
  RawResponse,
  SlicePerformance,
} from "@/lib/dashboard/types";

// --- Fixtures --------------------------------------------------------------
// Two completed attempts and one open attempt, all with explicit timestamps so
// the maths is deterministic regardless of when the suite runs.

const attempt = (overrides: Partial<RawAttempt> & Pick<RawAttempt, "id">): RawAttempt => ({
  id: overrides.id,
  mock_test_id: overrides.mock_test_id ?? `test-${overrides.id}`,
  title: overrides.title ?? "ADRE Mock Test",
  slug: overrides.slug ?? "adre-mock",
  status: overrides.status ?? "submitted",
  started_at: overrides.started_at ?? "2026-09-01T09:00:00.000Z",
  updated_at: overrides.updated_at ?? "2026-09-01T09:40:00.000Z",
  submitted_at: overrides.submitted_at === undefined ? "2026-09-01T09:40:00.000Z" : overrides.submitted_at,
  percentage: overrides.percentage ?? 70,
  answered_count: overrides.answered_count ?? 20,
  correct_count: overrides.correct_count ?? 14,
  wrong_count: overrides.wrong_count ?? 6,
  skipped_count: overrides.skipped_count ?? 0,
  total_questions: overrides.total_questions ?? 20,
  time_spent_seconds: overrides.time_spent_seconds ?? 1800,
});

const response = (overrides: Partial<RawResponse> & Pick<RawResponse, "question_id">): RawResponse => ({
  attempt_id: overrides.attempt_id ?? "a2",
  question_id: overrides.question_id,
  is_correct: overrides.is_correct === undefined ? true : overrides.is_correct,
  time_spent_seconds: overrides.time_spent_seconds ?? 45,
});

const meta = (id: string, topicId: string | null, subjectId: string | null): QuestionMeta => ({
  id,
  topic_id: topicId,
  subject_id: subjectId,
  difficulty_name: "Medium",
  has_explanation: true,
  question_text: `Question ${id}`,
});

const TOPIC_PERCENTAGE = "topic-percentage";
const TOPIC_REASONING = "topic-reasoning";
const SUBJECT_MATHS = "subject-maths";

/** 20 answers: 4 correct on the weak topic (6 wrong), 9 correct on the other (1 wrong). */
function sliceFixture() {
  const questions: Record<string, QuestionMeta> = {};
  const responses: RawResponse[] = [];

  for (let index = 0; index < 10; index += 1) {
    const id = `weak-${index}`;
    questions[id] = meta(id, TOPIC_PERCENTAGE, SUBJECT_MATHS);
    responses.push(response({ question_id: id, is_correct: index < 4 }));
  }
  for (let index = 0; index < 10; index += 1) {
    const id = `strong-${index}`;
    questions[id] = meta(id, TOPIC_REASONING, SUBJECT_MATHS);
    responses.push(response({ question_id: id, is_correct: index < 9 }));
  }

  return { questionMeta: new Map(Object.entries(questions)), responses };
}

describe("buildPerformance", () => {
  const attempts = [
    attempt({ id: "a2", percentage: 80, answered_count: 20, correct_count: 16, wrong_count: 4, time_spent_seconds: 1200, submitted_at: "2026-09-02T09:00:00.000Z" }),
    attempt({ id: "a1", percentage: 60, answered_count: 20, correct_count: 12, wrong_count: 8, time_spent_seconds: 1800, submitted_at: "2026-09-01T09:00:00.000Z" }),
  ];

  it("computes KPIs only from completed attempts", () => {
    const summary = buildPerformance([
      ...attempts,
      attempt({ id: "open", status: "in_progress", submitted_at: null, percentage: null }),
    ]);
    expect(summary.testsCompleted).toBe(2);
    expect(summary.averageScore).toBe(70);
    expect(summary.bestScore).toBe(80);
    expect(summary.questionsSolved).toBe(40);
    expect(summary.averageMinutes).toBe(25);
  });

  it("orders the series oldest to newest and reports the delta", () => {
    const summary = buildPerformance(attempts);
    expect(summary.series.map((point) => point.id)).toEqual(["a1", "a2"]);
    expect(summary.scoreDelta).toBe(20);
    expect(summary.trend).toBe("up");
  });

  it("falls back to attempt aggregates when no response rows exist", () => {
    expect(buildPerformance(attempts).accuracy).toBe(70);
  });

  it("prefers per-question accuracy when responses are supplied", () => {
    const summary = buildPerformance(
      [attempts[0]],
      [
        response({ attempt_id: "a2", question_id: "q1", is_correct: true }),
        response({ attempt_id: "a2", question_id: "q2", is_correct: false }),
      ]
    );
    expect(summary.accuracy).toBe(50);
  });

  it("returns nulls (never zeros) for a student with no completed attempts", () => {
    const summary = buildPerformance([]);
    expect(summary.testsCompleted).toBe(0);
    expect(summary.averageScore).toBeNull();
    expect(summary.bestScore).toBeNull();
    expect(summary.accuracy).toBeNull();
    expect(summary.averageMinutes).toBeNull();
    expect(summary.scoreDelta).toBeNull();
    expect(summary.trend).toBe("none");
  });
});

describe("buildStreak", () => {
  it("counts a run that ends today", () => {
    const streak = buildStreak({
      activityDates: ["2026-09-28", "2026-09-27"],
      attemptDates: ["2026-09-29"],
      today: "2026-09-29",
    });
    expect(streak.current).toBe(3);
    expect(streak.longest).toBe(3);
    expect(streak.activeToday).toBe(true);
  });

  it("keeps a run alive when today has no activity yet", () => {
    const streak = buildStreak({ activityDates: ["2026-09-28", "2026-09-27"], attemptDates: [], today: "2026-09-29" });
    expect(streak.current).toBe(2);
    expect(streak.activeToday).toBe(false);
  });

  it("breaks the current streak on a missed day and still reports the record", () => {
    const streak = buildStreak({
      activityDates: ["2026-09-10", "2026-09-11", "2026-09-12"],
      attemptDates: ["2026-09-20"],
      today: "2026-09-29",
    });
    expect(streak.current).toBe(0);
    expect(streak.longest).toBe(3);
    expect(streak.hasActivity).toBe(true);
  });

  it("deduplicates the same day recorded twice", () => {
    const streak = buildStreak({
      activityDates: ["2026-09-29"],
      attemptDates: ["2026-09-29"],
      today: "2026-09-29",
    });
    expect(streak.current).toBe(1);
    expect(streak.qualifyingDates).toEqual(["2026-09-29"]);
  });

  it("reports no activity for a brand new student", () => {
    const streak = buildStreak({ activityDates: [], attemptDates: [], today: "2026-09-29" });
    expect(streak).toMatchObject({ current: 0, longest: 0, activeToday: false, hasActivity: false });
  });
});

describe("buildSlicePerformance + selectWeakAreas", () => {
  const { questionMeta, responses } = sliceFixture();
  const attemptTimes = new Map([["a2", "2026-09-02T09:00:00.000Z"]]);
  const refs = [
    { id: TOPIC_PERCENTAGE, name: "Percentage", slug: "percentage" },
    { id: TOPIC_REASONING, name: "Reasoning", slug: "reasoning" },
  ];

  const slices = buildSlicePerformance({
    responses,
    questionMeta,
    refs,
    attemptTimes,
    kind: "topic",
    minSample: MIN_SAMPLES.topic,
    hrefFor: (slice) => topicPracticeHref(slice.name),
  });

  it("aggregates accuracy per topic from real answers only", () => {
    const percentage = slices.find((slice) => slice.id === TOPIC_PERCENTAGE);
    const reasoning = slices.find((slice) => slice.id === TOPIC_REASONING);
    expect(percentage?.attempted).toBe(10);
    expect(percentage?.correct).toBe(4);
    expect(percentage?.accuracy).toBe(40);
    expect(reasoning?.accuracy).toBe(90);
    expect(percentage?.band.code).toBe("needsPractice");
    expect(reasoning?.band.code).toBe("strong");
  });

  it("ignores questions with no topic tag and unanswered questions", () => {
    const untagged = buildSlicePerformance({
      responses: [response({ question_id: "u1", is_correct: true }), response({ question_id: "u2", is_correct: null })],
      questionMeta: new Map([
        ["u1", meta("u1", null, null)],
        ["u2", meta("u2", TOPIC_PERCENTAGE, SUBJECT_MATHS)],
      ]),
      refs,
      attemptTimes,
      kind: "topic",
      minSample: MIN_SAMPLES.topic,
      hrefFor: (slice) => topicPracticeHref(slice.name),
    });
    expect(untagged).toEqual([]);
  });

  it("marks a small sample as lowSample instead of labelling the student", () => {
    const small = buildSlicePerformance({
      responses: [response({ question_id: "s1", is_correct: false })],
      questionMeta: new Map([["s1", meta("s1", TOPIC_PERCENTAGE, SUBJECT_MATHS)]]),
      refs,
      attemptTimes,
      kind: "topic",
      minSample: MIN_SAMPLES.topic,
      hrefFor: (slice) => topicPracticeHref(slice.name),
    });
    expect(small[0].lowSample).toBe(true);
    expect(small[0].band.code).toBe("insufficient");
    expect(selectWeakAreas(small)).toEqual([]);
  });
});

describe("buildRecommendations", () => {
  const makeSlice = (overrides: Partial<SlicePerformance> & Pick<SlicePerformance, "id" | "name">): SlicePerformance => ({
    id: overrides.id,
    name: overrides.name,
    slug: overrides.slug ?? overrides.id,
    attempted: overrides.attempted ?? 12,
    correct: overrides.correct ?? 6,
    wrong: overrides.wrong ?? 6,
    accuracy: overrides.accuracy ?? 50,
    averageScore: overrides.averageScore ?? overrides.accuracy ?? 50,
    band: masteryBand(overrides.accuracy ?? 50, overrides.attempted ?? 12, MIN_SAMPLES.topic),
    trend: overrides.trend ?? "none",
    lowSample: overrides.lowSample ?? false,
    lastSeenAt: overrides.lastSeenAt ?? null,
    practiceHref: overrides.practiceHref ?? topicPracticeHref(overrides.name),
  });

  const weak = makeSlice({ id: "t1", name: "Percentage", accuracy: 38, attempted: 18, wrong: 11 });
  const mid = makeSlice({ id: "t2", name: "Time & Work", accuracy: 62, attempted: 14, wrong: 5 });
  const strong = makeSlice({ id: "t3", name: "Reasoning", accuracy: 91, attempted: 22, wrong: 2 });
  const tiny = makeSlice({ id: "t4", name: "Grammar", accuracy: 20, attempted: 2, lowSample: true });

  const base = {
    topics: [weak, mid, strong, tiny],
    subjects: [],
    recentWrongTopicIds: [],
    secondsPerSlice: new Map([["t1", 60]]),
    fallbackSeconds: 45,
  };

  it("puts weak topics first and derives the session size from real answer volume", () => {
    const [first] = buildRecommendations(base);
    expect(first.name).toBe("Percentage");
    expect(first.reasonKey).toBe("recommended.reason.needsPractice");
    expect(first.suggestedQuestions).toBeGreaterThanOrEqual(10);
    expect(first.suggestedQuestions).toBeLessThanOrEqual(20);
    expect(first.estimatedMinutes).toBe(first.suggestedQuestions);
  });

  it("never recommends a topic with too little data", () => {
    const ids = buildRecommendations(base).map((item) => item.id);
    expect(ids).not.toContain("t4");
  });

  it("de-duplicates a topic that is both weak and recently missed", () => {
    const recommendations = buildRecommendations({ ...base, recentWrongTopicIds: ["t1", "t2"] });
    const ids = recommendations.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("t1");
    expect(ids).toContain("t2");
  });

  it("falls back to subjects when no topic has enough data", () => {
    const subjectSlice = makeSlice({
      id: "s1",
      name: "Mathematics",
      accuracy: 44,
      practiceHref: subjectPracticeHref({ name: "Mathematics", slug: "mathematics" }),
    });
    const recommendations = buildRecommendations({
      ...base,
      topics: [tiny],
      subjects: [subjectSlice],
    });
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].kind).toBe("subject");
    expect(recommendations[0].href).toBe("/learn?subjectSlug=mathematics");
  });

  it("returns nothing when there is no usable data at all", () => {
    expect(buildRecommendations({ ...base, topics: [], subjects: [] })).toEqual([]);
  });
});

describe("buildWrongAnswers", () => {
  const attempts = [
    attempt({ id: "a2", submitted_at: "2026-09-02T09:00:00.000Z", title: "ADRE Mock 05" }),
    attempt({ id: "a1", submitted_at: "2026-09-01T09:00:00.000Z", title: "ADRE Mock 04" }),
  ];

  const questionMeta = new Map<string, QuestionMeta>([
    ["q1", { ...meta("q1", TOPIC_PERCENTAGE, SUBJECT_MATHS), difficulty_name: "Hard", has_explanation: true, question_text: "A long question   about percentages that definitely needs normalising and truncating." }],
    ["q2", { ...meta("q2", null, null), difficulty_name: null, has_explanation: false, question_text: "Untagged question" }],
  ]);

  const result = buildWrongAnswers({
    responses: [
      response({ attempt_id: "a1", question_id: "q1", is_correct: false }),
      response({ attempt_id: "a2", question_id: "q2", is_correct: false }),
      response({ attempt_id: "a2", question_id: "q1", is_correct: true }),
    ],
    questionMeta,
    attemptById: new Map(attempts.map((item) => [item.id, item])),
    topicNameById: new Map([[TOPIC_PERCENTAGE, "Percentage"]]),
  });

  it("counts every incorrect answer but only renders the newest rows", () => {
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].attemptId).toBe("a2");
    expect(result.items[1].attemptTitle).toBe("ADRE Mock 04");
  });

  it("exposes topic, difficulty and explanation availability without inventing them", () => {
    const [untagged, tagged] = result.items;
    expect(untagged.topicName).toBeNull();
    expect(untagged.difficultyName).toBeNull();
    expect(untagged.explanationAvailable).toBe(false);
    expect(tagged.topicName).toBe("Percentage");
    expect(tagged.difficultyName).toBe("Hard");
    expect(tagged.explanationAvailable).toBe(true);
    expect(tagged.practiceHref).toBe("/mock-tests?search=Percentage");
  });

  it("never flags a correct answer as a mistake", () => {
    expect(result.items.some((item) => item.questionId === "q1" && item.attemptId === "a2")).toBe(false);
  });
});

describe("buildTodayGoal", () => {
  const today = "2026-09-29";

  it("only counts tasks backed by real activity", () => {
    const goal = buildTodayGoal({ today, todayAttempts: [], todayActivity: null });
    expect(goal.completed).toBe(0);
    expect(goal.total).toBe(3); // the challenge task is not available yet
    expect(goal.percent).toBe(0);
    expect(goal.hasSignal).toBe(false);
    expect(goal.tasks.find((task) => task.id === "daily-challenge")?.available).toBe(false);
  });

  it("tracks a day where the student smashed every verifiable task", () => {
    const goal = buildTodayGoal({
      today,
      todayAttempts: [attempt({ id: "a1", answered_count: 25, time_spent_seconds: 2400 })],
      todayActivity: null,
    });
    expect(goal.completed).toBe(3);
    expect(goal.percent).toBe(100);
    expect(goal.hasSignal).toBe(true);
  });

  it("prefers recorded study-activity minutes over attempt time", () => {
    const activity: RawActivity = {
      activity_date: today,
      minutes_studied: 45,
      questions_attempted: 22,
      tests_completed: 1,
    };
    const goal = buildTodayGoal({ today, todayAttempts: [], todayActivity: activity });
    expect(goal.completed).toBe(3);
  });

  it("fully supports a challenge day once the engine exists", () => {
    const goal = buildTodayGoal({ today, todayAttempts: [], todayActivity: null, dailyChallengeAvailable: true });
    expect(goal.total).toBe(4);
    expect(goal.tasks.find((task) => task.id === "daily-challenge")?.available).toBe(true);
  });
});

describe("buildCalendar", () => {
  const today = "2026-09-29";

  it("returns one cell per day, oldest first", () => {
    const days = buildCalendar({ activity: [], attempts: [], today, weeks: 2 });
    expect(days).toHaveLength(14);
    // The window is aligned to Monday-first weeks: it opens on the Monday of
    // the previous week and closes on the current week's Sunday.
    expect(days[0].date).toBe("2026-09-21");
    expect(days[13].date).toBe("2026-10-04");
    expect(days.find((day) => day.isToday)?.date).toBe(today);
    expect(days.every((day) => day.intensity === 0)).toBe(true);
  });

  it("shades real activity and reports the day's numbers", () => {
    const days = buildCalendar({
      activity: [{ activity_date: "2026-09-28", minutes_studied: 75, questions_attempted: 30, tests_completed: 1 }],
      attempts: [attempt({ id: "a1", submitted_at: "2026-09-29T09:00:00.000Z", percentage: 82, time_spent_seconds: 1800 })],
      today,
      weeks: 1,
    });
    const yesterday = days.find((day) => day.date === "2026-09-28");
    const current = days.find((day) => day.date === today);
    expect(yesterday?.intensity).toBe(4);
    expect(yesterday?.questions).toBe(30);
    expect(current?.tests).toBe(1);
    expect(current?.minutes).toBe(30);
    expect(current?.bestScore).toBe(82);
  });

  it("maps minutes to the documented intensity bands", () => {
    expect(intensityForMinutes(0)).toBe(0);
    expect(intensityForMinutes(10)).toBe(1);
    expect(intensityForMinutes(20)).toBe(2);
    expect(intensityForMinutes(45)).toBe(3);
    expect(intensityForMinutes(90)).toBe(4);
  });

  it("groups days into Monday-first weeks", () => {
    const days = buildCalendar({ activity: [], attempts: [], today, weeks: 2 });
    const weeks = groupCalendarWeeks(days);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]).toHaveLength(7);
    expect(new Date(`${weeks[0][0].date}T00:00:00Z`).getUTCDay()).toBe(1);
  });
});

describe("buildActivityFeed", () => {
  it("lists completed attempts with their score, then study sessions", () => {
    const feed = buildActivityFeed({
      attempts: [
        attempt({ id: "a1", title: "ADRE Mock 04", percentage: 78, submitted_at: "2026-09-28T09:00:00.000Z" }),
        attempt({ id: "open", status: "in_progress", submitted_at: null, updated_at: "2026-09-29T09:00:00.000Z" }),
      ],
      activity: [{ activity_date: "2026-09-25", minutes_studied: 40, questions_attempted: 25, tests_completed: 0 }],
      accuracyByAttempt: new Map([["a1", 84]]),
    });

    expect(feed[0].inProgress).toBe(true);
    expect(feed[0].kindKey).toBe("activity.kindTest");
    expect(feed[1].score).toBe(78);
    expect(feed[1].accuracy).toBe(84);
    expect(feed[1].href).toBe("/test/result/a1");
    expect(feed[2].kindKey).toBe("activity.kindPractice");
  });

  it("stays empty for a student with no history", () => {
    expect(buildActivityFeed({ attempts: [], activity: [], accuracyByAttempt: new Map() })).toEqual([]);
  });
});

describe("achievements, level, continuation", () => {
  it("orders unlocked achievements first and never unlocks without a backend event", () => {
    const summary = buildAchievementSummary({
      catalog: [
        { id: "1", code: "first_test", name: "First Steps", description: null, xp_reward: 50 },
        { id: "2", code: "streak_7", name: "Week Warrior", description: null, xp_reward: 100 },
      ],
      earned: [],
    });
    expect(summary.unlocked).toBe(0);
    expect(summary.percent).toBe(0);
    expect(summary.items.every((item) => !item.unlocked && item.earnedAt === null)).toBe(true);
  });

  it("reflects a real earned row", () => {
    const summary = buildAchievementSummary({
      catalog: [
        { id: "1", code: "first_test", name: "First Steps", description: null, xp_reward: 50 },
        { id: "2", code: "streak_7", name: "Week Warrior", description: null, xp_reward: 100 },
      ],
      earned: [{ achievement_id: "2", earned_at: "2026-09-20T10:00:00.000Z" }],
    });
    expect(summary.unlocked).toBe(1);
    expect(summary.percent).toBe(50);
    expect(summary.items[0]).toMatchObject({ id: "2", unlocked: true });
  });

  it("shows XP as unavailable while the rewards engine has written nothing", () => {
    const progress = buildLevelProgress(0);
    expect(progress.available).toBe(false);
    expect(progress.level).toBe(1);
    expect(progress.percent).toBe(0);
  });

  it("tracks level progress from the stored XP value", () => {
    const progress = buildLevelProgress(250);
    expect(progress.available).toBe(true);
    expect(progress.level).toBe(2);
    expect(progress.nextLevelXp).toBe(400);
    expect(progress.percent).toBe(50);
  });

  it("continues only a genuinely open attempt", () => {
    expect(buildContinuation([attempt({ id: "a1" })])).toBeNull();

    const continuation = buildContinuation([
      attempt({ id: "old", status: "in_progress", answered_count: 3, total_questions: 20, updated_at: "2026-09-28T09:00:00.000Z" }),
      attempt({ id: "new", status: "in_progress", answered_count: 42, total_questions: 100, slug: "adre-mock-05", updated_at: "2026-09-29T09:00:00.000Z" }),
    ]);

    expect(continuation?.attemptId).toBe("new");
    expect(continuation?.percent).toBe(42);
    expect(continuation?.href).toBe("/test/adre-mock-05/attempt");
  });
});

describe("buildStudyInsight", () => {
  const emptyPerformance = buildPerformance([]);

  it("refuses to analyse a student with no completed attempts", () => {
    const insight = buildStudyInsight({
      performance: emptyPerformance,
      subjects: [],
      weakAreas: [],
      recommendations: [],
      wrongAnswersTotal: 0,
    });
    expect(insight.available).toBe(false);
    expect(insight.findings).toEqual([]);
    expect(insight.nextStep.key).toBe("insight.nextStepTest");
    expect(insight.practiceHref).toBeNull();
  });

  it("explains verified numbers and recommends the weakest topic", () => {
    const { questionMeta, responses } = sliceFixture();
    const attemptTimes = new Map([["a2", "2026-09-02T09:00:00.000Z"]]);
    const topics = buildSlicePerformance({
      responses,
      questionMeta,
      refs: [
        { id: TOPIC_PERCENTAGE, name: "Percentage", slug: "percentage" },
        { id: TOPIC_REASONING, name: "Reasoning", slug: "reasoning" },
      ],
      attemptTimes,
      kind: "topic",
      minSample: MIN_SAMPLES.topic,
      hrefFor: (slice) => topicPracticeHref(slice.name),
    });
    const subjects = buildSlicePerformance({
      responses,
      questionMeta,
      refs: [{ id: SUBJECT_MATHS, name: "Mathematics", slug: "mathematics" }],
      attemptTimes,
      kind: "subject",
      minSample: MIN_SAMPLES.subject,
      hrefFor: (slice) => subjectPracticeHref(slice),
    });
    const weakAreas = selectWeakAreas(topics);
    const recommendations = buildRecommendations({
      topics,
      subjects,
      recentWrongTopicIds: [],
      secondsPerSlice: new Map(),
      fallbackSeconds: null,
    });
    const performance = buildPerformance(
      [
        attempt({ id: "a2", percentage: 55, submitted_at: "2026-09-02T09:00:00.000Z" }),
        attempt({ id: "a1", percentage: 52, submitted_at: "2026-09-01T09:00:00.000Z" }),
      ],
      responses
    );

    const insight = buildStudyInsight({ performance, subjects, weakAreas, recommendations, wrongAnswersTotal: 0 });

    expect(insight.available).toBe(true);
    expect(insight.findings.map((finding) => finding.key)).toContain("insight.weakness");
    expect(insight.nextStep.key).toBe("insight.nextStepPractice");
    expect(insight.nextStep.params?.topic).toBe("Percentage");
    expect(insight.practiceHref).toBe("/mock-tests?search=Percentage");
  });

  it("suggests revising mistakes when that is the biggest lever", () => {
    const insight = buildStudyInsight({
      performance: buildPerformance([
        attempt({ id: "a1", percentage: 70, submitted_at: "2026-09-01T09:00:00.000Z" }),
        attempt({ id: "a2", percentage: 72, submitted_at: "2026-09-02T09:00:00.000Z" }),
      ]),
      subjects: [],
      weakAreas: [],
      recommendations: [],
      wrongAnswersTotal: 25,
    });
    expect(insight.nextStep.key).toBe("insight.nextStepRevise");
    expect(insight.nextStep.params?.count).toBe(25);
  });
});

describe("buildOnboarding", () => {
  it("marks nothing done for a brand new student and keeps every step actionable", () => {
    const onboarding = buildOnboarding({
      hasBoard: false,
      hasClass: false,
      testsCompleted: 0,
      analysisUnlocked: false,
      recommendationCount: 0,
    });
    expect(onboarding.isNewStudent).toBe(true);
    expect(onboarding.done).toBe(0);
    expect(onboarding.total).toBe(4);
    expect(onboarding.steps.every((step) => step.done === false)).toBe(true);
    expect(onboarding.steps[0].href).toBe("/settings");
    expect(onboarding.steps[1].href).toBe("/mock-tests");
  });

  it("reflects real progress for a returning student", () => {
    const onboarding = buildOnboarding({
      hasBoard: true,
      hasClass: true,
      testsCompleted: 3,
      analysisUnlocked: true,
      recommendationCount: 2,
    });
    expect(onboarding.isNewStudent).toBe(false);
    expect(onboarding.done).toBe(4);
  });
});

describe("buildDashboardData", () => {
  const NOW = new Date("2026-09-29T10:00:00.000Z");
  const { questionMeta, responses } = sliceFixture();

  const baseInput: DashboardBuildInput = {
    now: NOW,
    attempts: [],
    responses: [],
    questionMeta: new Map(),
    topics: [],
    subjects: [],
    activity: [],
    achievementsCatalog: [
      { id: "ach-1", code: "first_test", name: "First Steps", description: "Complete your first mock test", xp_reward: 50 },
    ],
    earnedAchievements: [],
    leaderboard: { entries: [], currentUser: null },
    studyPlan: null,
    profile: { total_xp: 0, daily_goal_minutes: 60, board_id: null, class_id: null },
  };

  it("gives a brand new student honest empty states instead of invented numbers", () => {
    const data = buildDashboardData(baseInput);

    expect(data.performance.testsCompleted).toBe(0);
    expect(data.performance.averageScore).toBeNull();
    expect(data.performance.accuracy).toBeNull();
    expect(data.performance.series).toEqual([]);
    expect(data.streak.current).toBe(0);
    expect(data.streak.hasActivity).toBe(false);
    expect(data.subjects).toEqual([]);
    expect(data.topics).toEqual([]);
    expect(data.weakAreas).toEqual([]);
    expect(data.recommendations).toEqual([]);
    expect(data.wrongAnswers).toEqual({ total: 0, items: [] });
    expect(data.continuation).toBeNull();
    expect(data.achievements.unlocked).toBe(0);
    expect(data.level.available).toBe(false);
    expect(data.insight.available).toBe(false);
    expect(data.leaderboard.entries).toEqual([]);
    expect(data.studyPlan).toBeNull();
    expect(data.onboarding.isNewStudent).toBe(true);
    expect(data.calendar).toHaveLength(35);
    expect(data.calendar.every((day) => day.intensity === 0)).toBe(true);
  });

  it("assembles every section for an active student from real rows only", () => {
    const attempts = [
      attempt({
        id: "a2",
        title: "ADRE Mock Test 05",
        slug: "adre-mock-05",
        percentage: 82,
        answered_count: 20,
        correct_count: 16,
        wrong_count: 4,
        time_spent_seconds: 1500,
        submitted_at: "2026-09-29T07:00:00.000Z",
      }),
      attempt({
        id: "a1",
        title: "ADRE Mock Test 04",
        slug: "adre-mock-04",
        percentage: 64,
        answered_count: 20,
        correct_count: 12,
        wrong_count: 8,
        time_spent_seconds: 1800,
        submitted_at: "2026-09-27T07:00:00.000Z",
      }),
      attempt({
        id: "open",
        status: "in_progress",
        answered_count: 10,
        total_questions: 20,
        submitted_at: null,
        // Recent touch so the open test is the newest feed entry.
        updated_at: "2026-09-29T08:00:00.000Z",
      }),
    ];

    const data = buildDashboardData({
      ...baseInput,
      attempts,
      responses: responses.map((row) => ({ ...row, attempt_id: "a2" })),
      questionMeta,
      topics: [
        { id: TOPIC_PERCENTAGE, name: "Percentage", slug: "percentage" },
        { id: TOPIC_REASONING, name: "Reasoning", slug: "reasoning" },
      ],
      subjects: [{ id: SUBJECT_MATHS, name: "Mathematics", slug: "mathematics" }],
      profile: { ...baseInput.profile, board_id: "board-1", class_id: "class-1" },
      leaderboard: {
        entries: [{ rank: 4, userId: "me", name: "Student", xp: 842, testsCompleted: 6, isCurrentUser: true }],
        currentUser: { rank: 4, userId: "me", name: "Student", xp: 842, testsCompleted: 6, isCurrentUser: true },
      },
    });

    // KPIs
    expect(data.performance.testsCompleted).toBe(2);
    expect(data.performance.averageScore).toBe(73);
    expect(data.performance.series.map((point) => point.id)).toEqual(["a1", "a2"]);
    // Activity on the 27th and today, so today's run is one day long.
    expect(data.streak.current).toBe(1);
    // Today's goal: one test and 20 questions today, but only 25 minutes studied.
    expect(data.todayGoal.tasks.find((task) => task.id === "mock-test")?.done).toBe(true);
    expect(data.todayGoal.tasks.find((task) => task.id === "questions")?.done).toBe(true);
    expect(data.todayGoal.tasks.find((task) => task.id === "study-time")?.done).toBe(false);
    // Analysis
    expect(data.topics.map((slice) => slice.name)).toEqual(["Reasoning", "Percentage"]);
    expect(data.weakAreas.map((area) => area.name)).toEqual(["Percentage"]);
    expect(data.recommendations.map((item) => item.name)).toContain("Percentage");
    expect(data.wrongAnswers.total).toBe(7);
    expect(data.wrongAnswers.items).toHaveLength(5);
    expect(data.subjects[0].practiceHref).toBe("/learn?subjectSlug=mathematics");
    // Resume, insight, onboarding
    expect(data.continuation?.attemptId).toBe("open");
    expect(data.insight.available).toBe(true);
    expect(data.insight.findings.length).toBeGreaterThan(0);
    expect(data.onboarding.isNewStudent).toBe(false);
    expect(data.onboarding.steps[0].done).toBe(true);
    // Activity feed is newest first and links back to the attempt
    expect(data.activity[0].inProgress).toBe(true);
    expect(data.activity.some((item) => item.href === "/test/result/a2")).toBe(true);
  });

  it("ignores responses that do not belong to a completed attempt", () => {
    const data = buildDashboardData({
      ...baseInput,
      attempts: [attempt({ id: "a1", submitted_at: "2026-09-01T07:00:00.000Z" })],
      responses: [
        { attempt_id: "a1", question_id: "q1", is_correct: true, time_spent_seconds: 30 },
        { attempt_id: "ghost", question_id: "q2", is_correct: false, time_spent_seconds: 30 },
      ],
      questionMeta: new Map([
        ["q1", meta("q1", TOPIC_PERCENTAGE, SUBJECT_MATHS)],
        ["q2", meta("q2", TOPIC_PERCENTAGE, SUBJECT_MATHS)],
      ]),
      topics: [{ id: TOPIC_PERCENTAGE, name: "Percentage", slug: "percentage" }],
    });

    expect(data.wrongAnswers.total).toBe(0);
    expect(data.topics[0].attempted).toBe(1);
  });
});







