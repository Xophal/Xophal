import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminRole: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdminRole: mocks.requireAdminRole }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { POST as createMockTest } from "@/app/api/mock-tests/route";

function createAdminClient(
  testTypeResult: {
    data: { id: string } | null;
    error: { code: string; message: string } | null;
  } = { data: { id: "full-mock-type" }, error: null }
) {
  const duplicateQuery = {
    select: vi.fn(() => duplicateQuery),
    eq: vi.fn(() => duplicateQuery),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const testTypeQuery = {
    select: vi.fn(() => testTypeQuery),
    eq: vi.fn(() => testTypeQuery),
    upsert: vi.fn(() => testTypeQuery),
    maybeSingle: vi.fn().mockResolvedValue(testTypeResult),
    single: vi.fn().mockResolvedValue({ data: { id: "created-full-mock-type" }, error: null }),
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
    testTypeQuery,
    insertQuery,
  };
}

function createRequest(body: { title: string; slug?: string } = { title: "Sample mock test", slug: "sample-mock-test" }) {
  return new NextRequest("http://localhost/api/mock-tests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mock-tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminRole.mockResolvedValue(undefined);
  });

  it("uses the seeded full_mock type when creating a test without an explicit type", async () => {
    const adminClient = createAdminClient();
    mocks.createAdminClient.mockReturnValue(adminClient);

    const response = await createMockTest(createRequest());

    expect(response.status).toBe(201);
    expect(adminClient.testTypeQuery.eq).toHaveBeenCalledWith("code", "full_mock");
    expect(adminClient.insertQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({ test_type_id: "full-mock-type" }),
    ]);
  });

  it("generates a URL slug from the title when one is omitted", async () => {
    const adminClient = createAdminClient();
    mocks.createAdminClient.mockReturnValue(adminClient);

    const response = await createMockTest(createRequest({ title: "Class 10 Science Full Test" }));

    expect(response.status).toBe(201);
    expect(adminClient.insertQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        title: "Class 10 Science Full Test",
        slug: "class-10-science-full-test",
        is_published: false,
      }),
    ]);
  });

  it("creates the default test type when the seeded row is missing", async () => {
    const adminClient = createAdminClient({ data: null, error: null });
    mocks.createAdminClient.mockReturnValue(adminClient);

    const response = await createMockTest(createRequest());

    expect(response.status).toBe(201);
    expect(adminClient.testTypeQuery.upsert).toHaveBeenCalledWith({
      code: "full_mock",
      name: "Full Mock Test",
      description: "Complete syllabus mock test",
      sort_order: 5,
    }, { onConflict: "code" });
    expect(adminClient.insertQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({ test_type_id: "created-full-mock-type" }),
    ]);
  });
});
