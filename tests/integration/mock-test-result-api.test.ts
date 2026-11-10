import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { GET as getMockTestResult } from "@/app/api/mock-tests/results/[attemptId]/route";

const attemptId = "00000000-0000-4000-8000-000000000001";
const questionId = "00000000-0000-4000-8000-000000000002";

function query(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

describe("GET /api/mock-tests/results/[attemptId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ user: { id: "student-1" } });
  });

  it("hides correct options and explanations when the test disables solutions", async () => {
    const responseRows = query({ data: [], error: null });
    const paperRows = query({
      data: [{
        question_id: questionId,
        position: 0,
        question_snapshot: {
          question_text: "What is 2 + 2?",
          explanation: "The answer is four.",
          options: [
            { id: "option-1", option_text: "4", is_correct: true },
            { id: "option-2", option_text: "5", is_correct: false },
          ],
        },
      }],
      error: null,
    });
    const attemptQuery = query({
      data: { id: attemptId, correct_count: 0, wrong_count: 0, mock_tests: { show_solutions: false } },
      error: null,
    });
    mocks.createClient.mockReturnValue({ from: vi.fn(() => attemptQuery) });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => table === "test_responses" ? responseRows : paperRows),
    });

    const response = await getMockTestResult(new Request("http://localhost/api/mock-tests/results"), {
      params: Promise.resolve({ attemptId }),
    });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.data.show_solutions).toBe(false);
    expect(result.data.test_responses[0].questions.explanation).toBeNull();
    expect(result.data.test_responses[0].questions.question_options.map((option: { is_correct: boolean }) => option.is_correct)).toEqual([false, false]);
  });
});
