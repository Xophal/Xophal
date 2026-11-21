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

function createQuery(result: { data: unknown; error: null }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  return query;
}

describe("POST /api/mock-tests/[slug]/attempt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ user: { id: "student-id" }, profile: {} });
    mocks.getUserEntitlement.mockRejectedValue(new Error("Billing service unavailable"));
    mocks.isProductEntitled.mockReturnValue(false);
  });

  it("starts a free test without querying subscription entitlement", async () => {
    const tables: Record<string, ReturnType<typeof createQuery>> = {
      mock_tests: createQuery({
        data: {
          id: "test-id",
          title: "Sample test",
          is_premium: false,
          duration_minutes: 30,
        },
        error: null,
      }),
      test_access_grants: createQuery({ data: null, error: null }),
      test_attempt_papers: createQuery({
        data: [{
          question_id: "question-id",
          position: 0,
          marks: 1,
          negative_marks: 0,
          question_snapshot: {
            id: "question-id",
            question_text: "Sample question",
            options: [],
          },
        }],
        error: null,
      }),
      mock_test_questions: createQuery({ data: [], error: null }),
      test_responses: createQuery({ data: [], error: null }),
    };
    const adminClient = {
      from: vi.fn((table: string) => tables[table]),
      rpc: vi.fn().mockResolvedValue({
        data: {
          id: "attempt-id",
          started_at: "2026-11-22T00:00:00.000Z",
          status: "in_progress",
          duration_minutes: 30,
          resumed: false,
        },
        error: null,
      }),
    };
    mocks.createAdminClient.mockReturnValue(adminClient);

    const response = await startMockTest(new Request("http://localhost/api/mock-tests/sample/attempt"), {
      params: Promise.resolve({ slug: "sample" }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ success: true });
    expect(mocks.getUserEntitlement).not.toHaveBeenCalled();
  });
});
