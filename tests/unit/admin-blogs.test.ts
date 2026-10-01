import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.single = vi.fn();
  builder.maybeSingle = vi.fn();
  return {
    builder,
    createAdminClient: vi.fn(),
    requireAdminAuth: vi.fn(),
    from: vi.fn(() => builder),
  };
});

vi.mock("@/lib/auth", () => ({ requireAdminAuth: mocks.requireAdminAuth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { POST } from "@/app/api/admin/blogs/route";
import { PATCH } from "@/app/api/admin/blogs/[id]/route";

function postRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/admin/blogs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin blog publishing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(mocks.builder).forEach((method) => {
      if (["insert", "update", "delete", "select", "eq"].some((key) => mocks.builder[key] === method)) {
        method.mockReturnValue(mocks.builder);
      }
    });
    mocks.requireAdminAuth.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.createAdminClient.mockReturnValue({ from: mocks.from });
    mocks.builder.single.mockResolvedValue({ data: { id: "post-1" }, error: null });
    mocks.builder.maybeSingle.mockResolvedValue({
      data: { id: "post-1", is_published: false, published_at: null, content: null },
      error: null,
    });
  });

  it("rejects publishing a new post without content", async () => {
    const response = await POST(postRequest({ title: "A useful article", is_published: true }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "BLOG_CONTENT_REQUIRED" });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("creates a title-derived slug when the supplied slug is blank", async () => {
    const response = await POST(postRequest({
      title: "A Useful Article!",
      slug: "",
      content: "Article body",
      is_published: true,
    }));

    expect(response.status).toBe(201);
    expect(mocks.builder.insert).toHaveBeenCalledWith([
      expect.objectContaining({ slug: "a-useful-article", published_at: expect.any(String) }),
    ]);
  });

  it("does not publish an existing post without body content", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost:3000/api/admin/blogs/post-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_published: true }),
      }),
      { params: Promise.resolve({ id: "post-1" }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "BLOG_CONTENT_REQUIRED" });
    expect(mocks.builder.update).not.toHaveBeenCalled();
  });
});