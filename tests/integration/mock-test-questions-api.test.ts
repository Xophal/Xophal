import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminRole: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdminRole: mocks.requireAdminRole }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import {
  GET as getTestQuestions,
  POST as addTestQuestions,
} from "@/app/api/admin/mock-tests/[mockTestId]/questions/route";
import { PATCH as updateMockTest } from "@/app/api/admin/mock-tests/[mockTestId]/route";

type QueryResult = { data: unknown; error: unknown; count?: number };

function query(result: QueryResult, singleResult: QueryResult = result) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    ilike: () => builder,
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: () => builder,
    maybeSingle: vi.fn().mockResolvedValue(singleResult),
    then: (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function setupAdminClient(queries: Record<string, QueryResult[]>, singles: Record<string, QueryResult[]> = {}) {
  const builders = new Map<string, ReturnType<typeof query>[]>();
  const admin = {
    from: vi.fn((table: string) => {
      const result = queries[table]?.shift() ?? { data: [], error: null };
      const single = singles[table]?.shift() ?? result;
      const builder = query(result, single);
      builders.set(table, [...(builders.get(table) ?? []), builder]);
      return builder;
    }),
  };
  return { admin, builders };
}

const readyQuestion = {
  id: "00000000-0000-4000-8000-000000000001",
  question_text: "What is 2 + 2?",
  status: "published",
  is_active: true,
  marks: 1,
  question_types: { code: "single_correct" },
  question_options: [
    { id: "option-1", is_correct: true },
    { id: "option-2", is_correct: false },
  ],
};

function context() {
  return { params: Promise.resolve({ mockTestId: "00000000-0000-4000-8000-000000000010" }) };
}

describe("admin mock-test question management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminRole.mockResolvedValue(undefined);
  });

  it("adds a published question with a valid answer key to a draft test", async () => {
    const { admin, builders } = setupAdminClient({
      mock_tests: [{ data: null, error: null }],
      questions: [{ data: [readyQuestion], error: null }],
      mock_test_questions: [
        { data: [], error: null },
        { data: null, error: null },
      ],
    }, {
      mock_tests: [{ data: { id: "test-1", is_published: false }, error: null }],
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const response = await addTestQuestions(
      new NextRequest("http://localhost/api/admin/mock-tests/test-1/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_ids: [readyQuestion.id] }),
      }),
      context()
    );

    expect(response.status).toBe(201);
    expect(builders.get("mock_test_questions")?.[1].insert).toHaveBeenCalledWith([
      { mock_test_id: "00000000-0000-4000-8000-000000000010", question_id: readyQuestion.id, sort_order: 0 },
    ]);
  });

  it("rejects unpublished questions instead of adding unusable test content", async () => {
    const { admin, builders } = setupAdminClient({
      mock_tests: [{ data: null, error: null }],
      questions: [{ data: [{ ...readyQuestion, status: "draft" }], error: null }],
    }, {
      mock_tests: [{ data: { id: "test-1", is_published: false }, error: null }],
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const response = await addTestQuestions(
      new NextRequest("http://localhost/api/admin/mock-tests/test-1/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_ids: [readyQuestion.id] }),
      }),
      context()
    );

    expect(response.status).toBe(400);
    expect(builders.get("mock_test_questions")).toBeUndefined();
  });

  it("prevents changing questions while a student attempt is in progress", async () => {
    const { admin, builders } = setupAdminClient({
      mock_tests: [{ data: null, error: null }],
      questions: [{ data: [readyQuestion], error: null }],
      test_attempts: [{ data: [{ id: "attempt-1" }], error: null }],
    }, {
      mock_tests: [{ data: { id: "test-1", is_published: true }, error: null }],
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const response = await addTestQuestions(
      new NextRequest("http://localhost/api/admin/mock-tests/test-1/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_ids: [readyQuestion.id] }),
      }),
      context()
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "TEST_HAS_ACTIVE_ATTEMPTS" });
    expect(builders.get("mock_test_questions")?.[0].insert).not.toHaveBeenCalled();
  });

  it("does not publish a test with no questions", async () => {
    const { admin } = setupAdminClient({
      mock_test_questions: [{ data: [], error: null }],
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const response = await updateMockTest(
      new NextRequest("http://localhost/api/admin/mock-tests/test-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: true }),
      }),
      context()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "TEST_NOT_READY" });
  });

  it("returns only eligible question-bank items for a test", async () => {
    const attachedQuestion = { ...readyQuestion, id: "00000000-0000-4000-8000-000000000002" };
    const { admin } = setupAdminClient({
      mock_tests: [{ data: null, error: null }],
      mock_test_questions: [{
        data: [{
          question_id: attachedQuestion.id,
          sort_order: 0,
          marks_override: null,
          questions: attachedQuestion,
        }],
        error: null,
      }],
      questions: [{
        data: [
          readyQuestion,
          { ...readyQuestion, id: "00000000-0000-4000-8000-000000000003", status: "draft" },
          { ...readyQuestion, id: "00000000-0000-4000-8000-000000000004", question_types: { code: "short" } },
        ],
        error: null,
      }],
    }, {
      mock_tests: [{ data: { id: "test-1", is_published: false }, error: null }],
    });
    mocks.createAdminClient.mockReturnValue(admin);

    const response = await getTestQuestions(
      new NextRequest("http://localhost/api/admin/mock-tests/test-1/questions"),
      context()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        attachedQuestions: [{ id: attachedQuestion.id }],
        availableQuestions: [{ id: readyQuestion.id }],
      },
    });
  });
});
