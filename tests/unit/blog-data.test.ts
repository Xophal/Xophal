import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  or: vi.fn(),
  contains: vi.fn(),
  order: vi.fn(),
  range: vi.fn(),
  maybeSingle: vi.fn(),
  neq: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

const query = {
  select: mocks.select,
  eq: mocks.eq,
  or: mocks.or,
  contains: mocks.contains,
  order: mocks.order,
  range: mocks.range,
  maybeSingle: mocks.maybeSingle,
  neq: mocks.neq,
  limit: mocks.limit,
};

import { getPublishedBlogBySlug, listPublishedBlogs } from "@/lib/blog-data";

describe("public blog data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(query).forEach((method) => method.mockReturnValue(query));
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => query) });
    mocks.range.mockResolvedValue({ data: [], error: null, count: 0 });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("only returns published posts for a slug", async () => {
    await getPublishedBlogBySlug("published-post");

    expect(mocks.eq).toHaveBeenCalledWith("slug", "published-post");
    expect(mocks.eq).toHaveBeenCalledWith("is_published", true);
  });

  it("normalizes search and tag filters and clamps pagination", async () => {
    await listPublishedBlogs({ page: -4, pageSize: 500, search: "study,) OR *", tag: "Exam! Prep" });

    expect(mocks.eq).toHaveBeenCalledWith("is_published", true);
    expect(mocks.or).toHaveBeenCalledWith("title.ilike.%study OR%,excerpt.ilike.%study OR%");
    expect(mocks.contains).toHaveBeenCalledWith("tags", ["Exam Prep"]);
    expect(mocks.range).toHaveBeenCalledWith(0, 29);
  });
});