import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminRole: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdminRole: mocks.requireAdminRole }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { POST as createMockTest } from "@/app/api/mock-tests/route";
import { POST as attachQuestion } from "@/app/api/admin/mock-tests/[mockTestId]/questions/route";

function createAdminClient() {
  const duplicateQuery = {
    select: vi.fn(() => duplicateQuery),
    eq: vi.fn(() => duplicateQuery),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const testTypeQuery = {
    select: vi.fn(() => testTypeQuery),
    eq: vi.fn(() => testTypeQuery),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "full-mock-type" }, error: null }),
  };
  const insertQuery = {
    insert: vi.fn(() => insertQuery),
    select: vi.fn(() => insertQuery),
    single: vi.fn().mockResolvedValue({ data: { id: "new-mock-test" }, error: null }),
  };
  const mockTestQueries = [duplicateQuery, insertQuery];

  return {
    from: vi.fn((table: string) => {
      if (table === "test_types") return testTypeQuery;
      return mockTestQueries.shift();
    }),
  };
}

describe("POST /api/mock-tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminRole.mockResolvedValue(undefined);
    mocks.createAdminClient.mockReturnValue(createAdminClient());
  });

  it("uses the seeded full_mock type when creating a test without an explicit type", async () => {
    const request = new NextRequest("http://localhost/api/mock-tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Sample mock test", slug: "sample-mock-test" }),
    });

    const response = await createMockTest(request);

    expect(response.status).toBe(201);
    expect(mocks.requireAdminRole).toHaveBeenCalled();
    const adminClient = mocks.createAdminClient.mock.results[0].value;
    expect(adminClient.from).toHaveBeenCalledWith("test_types");
    expect(adminClient.from.mock.results[1].value.eq).toHaveBeenCalledWith("code", "full_mock");
  });

  it("refuses to publish a newly created test before it can contain questions", async () => {
    const request = new NextRequest("http://localhost/api/mock-tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Empty test", slug: "empty-test", is_published: true }),
    });

    const response = await createMockTest(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: "TEST_EMPTY" });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("attaches an active published question to an existing test", async () => {
    const testQuery = {
      select: vi.fn(() => testQuery),
      eq: vi.fn(() => testQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "test-1" }, error: null }),
    };
    const questionQuery = {
      select: vi.fn(() => questionQuery),
      eq: vi.fn(() => questionQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "question-1", marks: 2 }, error: null }),
    };
    const noExistingLinkQuery = {
      select: vi.fn(() => noExistingLinkQuery),
      eq: vi.fn(() => noExistingLinkQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const orderQuery = {
      select: vi.fn(() => orderQuery),
      eq: vi.fn(() => orderQuery),
      order: vi.fn(() => orderQuery),
      limit: vi.fn(() => orderQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: { sort_order: 3 }, error: null }),
    };
    const insertQuery = {
      insert: vi.fn(() => insertQuery),
      select: vi.fn(() => insertQuery),
      single: vi.fn().mockResolvedValue({ data: { question_id: "question-1", sort_order: 4 }, error: null }),
    };
    const relationQueries = [noExistingLinkQuery, orderQuery, insertQuery];
    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === "mock_tests") return testQuery;
        if (table === "questions") return questionQuery;
        return relationQueries.shift();
      }),
    };
    mocks.createAdminClient.mockReturnValue(adminClient);
    const request = new NextRequest("http://localhost/api/admin/mock-tests/test-1/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: "11111111-1111-4111-8111-111111111111" }),
    });

    const response = await attachQuestion(request, { params: Promise.resolve({ mockTestId: "test-1" }) });

    expect(response.status).toBe(201);
    expect(questionQuery.eq).toHaveBeenCalledWith("status", "published");
    expect(insertQuery.insert).toHaveBeenCalledWith({
      mock_test_id: "test-1",
      question_id: "11111111-1111-4111-8111-111111111111",
      section_id: null,
      sort_order: 4,
      marks_override: null,
    });
  });
});