import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getAttemptState: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/engine/attempt-service", () => ({ getAttemptState: mocks.getAttemptState }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { GET } from "@/app/api/attempts/[attemptId]/result/route";

const attempt = {
  attemptId: "attempt-1",
  instanceId: "instance-1",
  blueprintId: "blueprint-1",
  blueprintSlug: "legacy-test",
  blueprintTitle: "Legacy Test",
  status: "submitted" as const,
  startedAt: "2026-10-27T00:00:00.000Z",
  deadlineAt: "2026-10-27T01:00:00.000Z",
  maxScore: 1,
  score: 1,
  durationSec: 3600,
  questionCount: 1,
  resumed: false,
};

function mockAdmin(showSolutions: boolean) {
  const query = (result: { data: unknown; error: null }) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle: vi.fn().mockResolvedValue(result),
      order: vi.fn().mockResolvedValue(result),
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return builder;
  };

  const blueprintQuery = query({ data: { source_mock_test_id: "legacy-1" }, error: null });
  const sourceTestQuery = query({ data: { show_solutions: showSolutions }, error: null });
  const questionRowsQuery = query({
    data: [{
      question_id: "question-1",
      position: 0,
      marks: 1,
      neg_marks: 0,
      question_snapshot: { stem: "Question", explanation: "Reason", options: [] },
    }],
    error: null,
  });
  const attemptAnswersQuery = query({
    data: [{
      question_id: "question-1",
      response_json: { selected_options: ["A"] },
      is_correct: true,
      marks_awarded: 1,
      time_spent_sec: 10,
      flagged: false,
    }],
    error: null,
  });
  const solutionQuery = query({
    data: [{ question_id: "question-1", answer_json: { correct_options: ["A"] } }],
    error: null,
  });

  const from = vi.fn((table: string) => {
    switch (table) {
      case "blueprints": return blueprintQuery;
      case "mock_tests": return sourceTestQuery;
      case "test_instance_questions": return questionRowsQuery;
      case "attempt_answers": return attemptAnswersQuery;
      case "test_instance_answers": return solutionQuery;
      default: throw new Error(`Unexpected table: ${table}`);
    }
  });

  return { admin: { from }, from, solutionQuery };
}

describe("engine attempt result route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ user: { id: "student-1" } });
    mocks.getAttemptState.mockResolvedValue(attempt);
  });

  it("does not fetch or disclose answer keys or per-question grading when review is disabled", async () => {
    const database = mockAdmin(false);
    mocks.createAdminClient.mockReturnValue(database.admin);

    const response = await GET(new NextRequest("http://localhost/api/attempts/attempt-1/result"), {
      params: Promise.resolve({ attemptId: "attempt-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.reviewAllowed).toBe(false);
    expect(body.data.questions[0]).toMatchObject({
      question: { explanation: null },
      answer: null,
      response: { is_correct: null, marks_awarded: null },
    });
    expect(database.from).not.toHaveBeenCalledWith("test_instance_answers");
  });

  it("returns answer review when the linked legacy test allows solutions", async () => {
    const database = mockAdmin(true);
    mocks.createAdminClient.mockReturnValue(database.admin);

    const response = await GET(new NextRequest("http://localhost/api/attempts/attempt-1/result"), {
      params: Promise.resolve({ attemptId: "attempt-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.reviewAllowed).toBe(true);
    expect(body.data.questions[0]).toMatchObject({
      question: { explanation: "Reason" },
      answer: { correct_options: ["A"] },
      response: { is_correct: true, marks_awarded: 1 },
    });
    expect(database.from).toHaveBeenCalledWith("test_instance_answers");
  });

  it("rejects an attempt that is still in progress", async () => {
    mocks.getAttemptState.mockResolvedValue({ ...attempt, status: "in_progress" });

    const response = await GET(new NextRequest("http://localhost/api/attempts/attempt-1/result"), {
      params: Promise.resolve({ attemptId: "attempt-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("RESULT_NOT_READY");
    expect(mocks.createAdminClient).toHaveBeenCalledOnce();
  });
});
