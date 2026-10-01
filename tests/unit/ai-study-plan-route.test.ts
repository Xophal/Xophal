import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  limit: vi.fn(),
  createClient: vi.fn(),
  generateStudyPlan: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/redis", () => ({ aiRateLimit: { limit: mocks.limit } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/ai-planner", () => ({ generateStudyPlan: mocks.generateStudyPlan }));

import { POST } from "@/app/api/ai/study-plans/route";

const generatedPlan = {
  title: "Science study plan",
  summary: "A balanced study week.",
  days: Array.from({ length: 7 }, (_, index) => ({
    day: `Day ${index + 1}`,
    theme: "Practice",
    focus: "Review a concept and solve practice questions.",
    durationMinutes: 45,
  })),
  source: "openai" as const,
};

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/ai/study-plans", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockDatabase() {
  const insertedRecord = { id: "plan-1" };
  const insertSingle = vi.fn().mockResolvedValue({ data: insertedRecord, error: null });
  const updateQuery = {
    eq: vi.fn(),
    neq: vi.fn().mockResolvedValue({ error: null }),
  };
  updateQuery.eq.mockReturnValue(updateQuery);
  const from = vi.fn(() => ({
    insert: vi.fn(() => ({ select: () => ({ single: insertSingle }) })),
    update: vi.fn(() => updateQuery),
  }));
  return { client: { from }, from, insertSingle, updateQuery };
}

describe("AI study plan route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({
      user: { id: "student-1" },
      profile: { roles: { code: "student" } },
    });
    mocks.limit.mockResolvedValue({ success: true });
    mocks.generateStudyPlan.mockResolvedValue(generatedPlan);
    mocks.createClient.mockResolvedValue(mockDatabase().client);
  });

  it("requires an authenticated student", async () => {
    mocks.requireAuth.mockResolvedValue(null);

    const response = await POST(makeRequest({ goal: "Improve science" }));

    expect(response.status).toBe(401);
    expect(mocks.limit).not.toHaveBeenCalled();
    expect(mocks.generateStudyPlan).not.toHaveBeenCalled();
  });

  it("rejects non-student profiles", async () => {
    mocks.requireAuth.mockResolvedValue({
      user: { id: "admin-1" },
      profile: { roles: { code: "admin" } },
    });

    const response = await POST(makeRequest({ goal: "Improve science" }));

    expect(response.status).toBe(403);
    expect(mocks.limit).not.toHaveBeenCalled();
  });

  it("applies the rate limit to the authenticated student", async () => {
    mocks.limit.mockResolvedValue({ success: false });

    const response = await POST(makeRequest({ goal: "Improve science" }));

    expect(response.status).toBe(429);
    expect(mocks.limit).toHaveBeenCalledWith("study-plan:student-1");
    expect(mocks.generateStudyPlan).not.toHaveBeenCalled();
  });

  it("rejects oversized or invalid planner input before generation", async () => {
    const response = await POST(makeRequest({ goal: "x".repeat(9000) }));

    expect(response.status).toBe(413);
    expect(mocks.generateStudyPlan).not.toHaveBeenCalled();
  });

  it("stores the generated plan for its owner and returns its source", async () => {
    const database = mockDatabase();
    mocks.createClient.mockResolvedValue(database.client);

    const response = await POST(makeRequest({ goal: "Improve science", topics: ["Forces"] }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({ plan: generatedPlan, source: "openai", record: { id: "plan-1" } });
    expect(database.from).toHaveBeenCalledWith("ai_study_plans");
    expect(mocks.generateStudyPlan).toHaveBeenCalledWith({ goal: "Improve science", topics: ["Forces"] });
  });
});