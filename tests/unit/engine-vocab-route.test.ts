import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminRole: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdminRole: mocks.requireAdminRole }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { GET, POST } from "@/app/api/admin/engine/vocab/route";

function resolvedQuery(result: { data: unknown; error: null }) {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    ilike: vi.fn(() => query),
    eq: vi.fn(() => query),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  return query;
}

describe("engine question vocabulary route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminRole.mockResolvedValue({ profile: { roles: [{ code: "reviewer" }] } });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => resolvedQuery({ data: table === "question_review_counts" ? [] : [], error: null })),
    });
  });

  it("allows reviewer role to load the page's topics, subtopics, and review counts", async () => {
    const response = await GET(new NextRequest("http://localhost/api/admin/engine/vocab"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ topics: [], subtopics: [], reviewCounts: {} });
    expect(mocks.requireAdminRole).toHaveBeenCalledWith(["super_admin", "admin", "content_manager", "reviewer"]);
  });

  it("allows reviewer role to load subtopics used by the question editor", async () => {
    const response = await POST(new NextRequest("http://localhost/api/admin/engine/vocab", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topicId: "topic-id" }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.requireAdminRole).toHaveBeenCalledWith(["super_admin", "admin", "content_manager", "reviewer"]);
  });
});
