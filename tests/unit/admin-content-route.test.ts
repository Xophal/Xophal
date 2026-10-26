import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminAuth: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdminAuth: mocks.requireAdminAuth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { PUT } from "@/app/api/admin/content/route";
import { POST as retiredContentPost } from "@/app/api/content/route";

function createUpdateRequest(type: string) {
  return new NextRequest("http://localhost/api/admin/content", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: "content-1",
      type,
      title: "Updated content",
      content: "Updated body",
      status: "published",
    }),
  });
}

describe("admin content routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminAuth.mockResolvedValue({ user: { id: "admin-1" } });
  });

  it("updates notes in the notes table instead of the blogs table", async () => {
    const query: Record<string, ReturnType<typeof vi.fn>> = {};
    query.update = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.select = vi.fn(() => query);
    query.maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "content-1", title: "Updated content" },
      error: null,
    });
    const from = vi.fn((table: string) => {
      if (table !== "notes") throw new Error(`Unexpected table: ${table}`);
      return query;
    });
    mocks.createAdminClient.mockReturnValue({ from });

    const response = await PUT(createUpdateRequest("note"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(from).toHaveBeenCalledWith("notes");
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({
      title: "Updated content",
      is_active: true,
    }));
  });

  it("rejects unsupported content types rather than silently treating them as blogs", async () => {
    const response = await PUT(createUpdateRequest("faq"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("UNSUPPORTED_CONTENT_TYPE");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("does not report the retired non-persistent endpoint as a successful save", async () => {
    const response = await retiredContentPost();
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.success).toBe(false);
    expect(body.code).toBe("ENDPOINT_RETIRED");
  });
});
