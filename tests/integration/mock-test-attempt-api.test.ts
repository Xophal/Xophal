import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  createAdminClient: vi.fn(),
  getUserEntitlement: vi.fn(),
  isProductEntitled: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/entitlements", () => ({
  getUserEntitlement: mocks.getUserEntitlement,
  isProductEntitled: mocks.isProductEntitled,
}));

import { POST as startMockTest } from "@/app/api/mock-tests/[slug]/attempt/route";

const questionId = "00000000-0000-4000-8000-000000000001";
const sectionId = "00000000-0000-4000-8000-000000000002";
const testId = "00000000-0000-4000-8000-000000000003";
const attemptId = "00000000-0000-4000-8000-000000000004";

function query(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

describe("POST /api/mock-tests/[slug]/attempt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ user: { id: "student-1" }, profile: { id: "student-1" } });
    mocks.getUserEntitlement.mockResolvedValue({ isPaid: false, productType: "free" });
    mocks.isProductEntitled.mockReturnValue(false);

    const tables: Record<string, ReturnType<typeof query>[]> = {
      mock_tests: [query({
        data: {
          id: testId,
          is_premium: false,
          is_published: true,
          is_active: true,
          allow_review: false,
          show_solutions: false,
          duration_minutes: 30,
          title: "Test",
        },
        error: null,
      })],
      test_attempts: [query({ data: null, error: null })],
      mock_test_questions: [
        query({ data: [{ question_id: questionId, section_id: sectionId }], error: null }),
      ],
      questions: [query({ data: [{ id: questionId }], error: null })],
      test_access_grants: [query({ data: null, error: null })],
      mock_test_sections: [query({ data: [{ id: sectionId, name: "Algebra" }], error: null })],
      test_attempt_papers: [query({
        data: [{
          question_id: questionId,
          position: 0,
          marks: 1,
          question_snapshot: {
            id: questionId,
            question_text: "What is 2 + 2?",
            explanation: "The answer is four.",
            question_type: { code: "single_correct" },
            options: [
              { id: "option-1", is_correct: true },
              { id: "option-2", is_correct: false },
            ],
          },
        }],
        error: null,
      })],
      test_responses: [query({ data: [], error: null })],
    };

    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        const nextQuery = tables[table]?.shift();
        if (!nextQuery) throw new Error(`Unexpected or exhausted query for ${table}`);
        return nextQuery;
      }),
      rpc: vi.fn().mockResolvedValue({
        data: {
          id: attemptId,
          started_at: "2026-11-10T00:00:00.000Z",
          status: "in_progress",
          duration_minutes: 30,
          resumed: false,
        },
        error: null,
      }),
    });
  });

  it("returns assigned section labels without exposing answer explanations or keys", async () => {
    const response = await startMockTest(new Request("http://localhost/api/mock-tests/test/attempt"), {
      params: Promise.resolve({ slug: "test" }),
    });
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result.data.questions[0]).toMatchObject({ section_name: "Algebra" });
    expect(result.data.questions[0]).not.toHaveProperty("explanation");
    expect(result.data.questions[0].options.map((option: { is_correct: boolean }) => option.is_correct)).toEqual([false, false]);
    expect(result.data.test).toMatchObject({ allow_review: false, show_solutions: false });
  });
});
