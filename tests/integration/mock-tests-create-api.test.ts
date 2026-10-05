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
    maybeSingle: vi.fn().mockResolvedValue(testTypeResult),
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

function createRequest() {
  return new NextRequest("http://localhost/api/mock-tests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Sample mock test", slug: "sample-mock-test" }),
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

  it("returns a clear configuration error when the seeded test type is missing", async () => {
    mocks.createAdminClient.mockReturnValue(createAdminClient({ data: null, error: null }));

    const response = await createMockTest(createRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "TEST_TYPE_NOT_CONFIGURED",
    });
  });
});
