import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminAuth: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdminAuth: mocks.requireAdminAuth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { GET } from "@/app/api/admin/analytics/route";

type CountResponse = { count: number | null; error: Error | null };

function createCountQuery(response: CountResponse) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    then: (resolve: (value: CountResponse) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(response).then(resolve, reject),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.lte.mockReturnValue(query);
  return query;
}

function setupAdminClient(trendError: Error | null = null) {
  const responsesByTable: Record<string, CountResponse[]> = {
    profiles: [{ count: 120, error: null }, { count: 32, error: null }],
    mock_tests: [{ count: 14, error: null }, { count: 9, error: null }],
    test_attempts: [{ count: 45, error: null }, { count: 38, error: null }],
  };
  const from = vi.fn((table: string) => {
    const response = responsesByTable[table]?.shift();
    if (!response) throw new Error(`Unexpected query for table ${table}`);
    return createCountQuery(response);
  });
  const rpc = vi.fn(async (name: string) => {
    if (name === "get_admin_assessment_metrics") {
      return {
        data: [{ average_score: 16.25, average_percentage: 72.5, average_accuracy: 81.25 }],
        error: null,
      };
    }
    if (name === "get_test_popularity") {
      return { data: [{ id: "test-1", title: "Physics", attempts: 22 }], error: null };
    }
    if (name === "get_daily_attempts_summary") {
      return {
        data: trendError ? null : [{ date: "2026-03-01", completed_count: 7 }],
        error: trendError,
      };
    }
    throw new Error(`Unexpected RPC ${name}`);
  });
  mocks.createAdminClient.mockReturnValue({ from, rpc });
  return { from, rpc };
}

describe("admin analytics route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminAuth.mockResolvedValue({ user: { id: "admin-1" } });
  });

  it("uses exact counts and the existing analytics RPCs", async () => {
    const { rpc } = setupAdminClient();
    const response = await GET(new NextRequest("http://localhost/api/admin/analytics?range=7d&testId=test-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      users: { total: 120, active: 32 },
      tests: { total: 14, published: 9 },
      attempts: { total: 45, completed: 38 },
      averages: { averageScore: 16.25, averagePercentage: 72.5, averageAccuracy: 81.25 },
      topTests: [{ id: "test-1", title: "Physics", attempts: 22 }],
      trends: [{ date: "2026-03-01", completed_count: 7 }],
    });
    expect(rpc).toHaveBeenCalledWith("get_admin_assessment_metrics", expect.objectContaining({ p_test_id: "test-1" }));
    expect(rpc).toHaveBeenCalledWith("get_test_popularity", expect.any(Object));
    expect(rpc).toHaveBeenCalledWith("get_daily_attempts_summary", expect.any(Object));
  });

  it("rejects unknown ranges instead of silently reporting all-time data", async () => {
    const response = await GET(new NextRequest("http://localhost/api/admin/analytics?range=unknown"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_RANGE");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("returns an error when an analytics RPC fails instead of an empty successful chart", async () => {
    const error = new Error("trend query failed");
    setupAdminClient(error);
    const logError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(new NextRequest("http://localhost/api/admin/analytics?range=7d"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(logError).toHaveBeenCalled();
    logError.mockRestore();
  });
});
