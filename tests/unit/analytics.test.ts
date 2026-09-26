import { describe, expect, it } from "vitest";
import {
  buildAttemptSeries,
  buildOutcomeSplit,
  buildStudySeries,
  buildSummary,
  describeTrend,
  getAttemptTitle,
  type ActivityRow,
  type AttemptRow,
} from "@/lib/analytics";

const attempts: AttemptRow[] = [
  {
    id: "a3",
    percentage: 80,
    correct_count: 8,
    wrong_count: 2,
    skipped_count: 0,
    time_spent_seconds: 600,
    submitted_at: "2026-03-03T10:00:00.000Z",
    title: "Physics Full Test",
  },
  {
    id: "a2",
    percentage: 60,
    correct_count: 6,
    wrong_count: 4,
    skipped_count: 0,
    time_spent_seconds: 480,
    submitted_at: "2026-03-02T10:00:00.000Z",
    title: "Chemistry Test",
  },
  {
    id: "a1",
    percentage: 40,
    correct_count: 4,
    wrong_count: 6,
    skipped_count: 0,
    time_spent_seconds: 300,
    submitted_at: "2026-03-01T10:00:00.000Z",
  },
];

describe("buildAttemptSeries", () => {
  it("returns the most recent attempts oldest-to-newest for charting", () => {
    const series = buildAttemptSeries(attempts);
    expect(series).toHaveLength(3);
    expect(series.map((point) => point.id)).toEqual(["a1", "a2", "a3"]);
    expect(series[2].score).toBe(80);
    expect(series[2].title).toBe("Physics Full Test");
  });

  it("clamps impossible scores and skips rows without a score", () => {
    const series = buildAttemptSeries([
      { id: "x", percentage: 140, correct_count: 1, wrong_count: 0, skipped_count: 0, time_spent_seconds: 0, submitted_at: null },
      { id: "y", percentage: null, correct_count: 1, wrong_count: 0, skipped_count: 0, time_spent_seconds: 0, submitted_at: null },
    ]);
    expect(series).toHaveLength(1);
    expect(series[0].score).toBe(100);
    expect(series[0].title).toBe("Mock test");
  });

  it("is order-independent, always returning oldest-to-newest", () => {
    const shuffled = [attempts[1], attempts[2], attempts[0]];
    expect(buildAttemptSeries(shuffled).map((point) => point.id)).toEqual(["a1", "a2", "a3"]);
  });

  it("honours the limit", () => {
    expect(buildAttemptSeries(attempts, 2)).toHaveLength(2);
  });
});

describe("buildSummary", () => {
  it("computes averages, accuracy and totals from real rows", () => {
    const summary = buildSummary(attempts);
    expect(summary.testsCompleted).toBe(3);
    expect(summary.averageScore).toBe(60);
    expect(summary.bestScore).toBe(80);
    expect(summary.questionsAnswered).toBe(30);
    expect(summary.questionsCorrect).toBe(18);
    expect(summary.accuracy).toBe(60);
    expect(summary.totalMinutes).toBe(23);
  });

  it("reports the delta between the latest two attempts", () => {
    expect(buildSummary(attempts).scoreDelta).toBe(20);
  });

  it("returns zeroed, safe values with no data", () => {
    const summary = buildSummary([]);
    expect(summary).toEqual({
      testsCompleted: 0,
      averageScore: 0,
      bestScore: 0,
      accuracy: 0,
      questionsAnswered: 0,
      questionsCorrect: 0,
      totalMinutes: 0,
      scoreDelta: null,
    });
  });

  it("prefers study activity over raw attempt time when available", () => {
    const activity: ActivityRow[] = [
      { activity_date: "2026-03-03", minutes_studied: 30 },
      { activity_date: "2026-03-02", minutes_studied: 15 },
    ];
    expect(buildSummary(attempts, activity).totalMinutes).toBe(45);
  });
});

describe("buildOutcomeSplit", () => {
  it("sums correct, incorrect and skipped questions", () => {
    expect(buildOutcomeSplit(attempts)).toEqual({ correct: 18, incorrect: 12, skipped: 0 });
  });
});

describe("buildStudySeries", () => {
  const now = new Date("2026-03-08T12:00:00.000Z");

  it("returns one point per day, oldest first", () => {
    const series = buildStudySeries([], [], 7, now);
    expect(series).toHaveLength(7);
    expect(series[6].key).toBe("2026-03-08");
    expect(series.every((point) => point.minutes === 0)).toBe(true);
  });

  it("maps study activity onto the matching day", () => {
    const series = buildStudySeries([{ activity_date: "2026-03-08", minutes_studied: 42 }], [], 7, now);
    expect(series[6].minutes).toBe(42);
    expect(series[5].minutes).toBe(0);
  });

  it("falls back to attempt time when no activity rows exist", () => {
    const series = buildStudySeries([], [
      { id: "a", percentage: 50, correct_count: 1, wrong_count: 1, skipped_count: 0, time_spent_seconds: 1800, submitted_at: "2026-03-08T09:00:00.000Z" },
    ], 7, now);
    expect(series[6].minutes).toBe(30);
  });
});

describe("describeTrend", () => {
  it("describes direction, level and insufficient data", () => {
    expect(describeTrend(12.5)).toBe("Up 12.5 points versus your previous test.");
    expect(describeTrend(-4)).toBe("Down 4 points versus your previous test.");
    expect(describeTrend(0)).toBe("Level with your previous test.");
    expect(describeTrend(null)).toBeNull();
  });
});

describe("getAttemptTitle", () => {
  it("falls back to a generic label", () => {
    expect(getAttemptTitle({ title: "  " })).toBe("Mock test");
    expect(getAttemptTitle({ title: "Maths Test" })).toBe("Maths Test");
  });
});