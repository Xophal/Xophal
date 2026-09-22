import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  createClient: vi.fn(),
  getCached: vi.fn(),
  setCache: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/redis", () => ({ getCached: mocks.getCached, setCache: mocks.setCache }));

import { GET } from "@/app/api/classes/route";

const board = { id: "board-1" };
const classes = [{ id: "class-1", board_id: "board-1", name: "Class 10" }];

function createSupabaseClient() {
  const boardQuery = {
    select: vi.fn(() => boardQuery),
    eq: vi.fn(() => boardQuery),
    maybeSingle: vi.fn().mockResolvedValue({ data: board }),
  };
  const classQuery = {
    select: vi.fn(() => classQuery),
    eq: vi.fn(() => classQuery),
    order: vi.fn().mockResolvedValue({ data: classes, error: null }),
  };

  return { from: vi.fn((table: string) => (table === "boards" ? boardQuery : classQuery)) };
}

function request(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

describe("GET /api/classes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue(undefined);
    mocks.getCached.mockResolvedValue(null);
    mocks.setCache.mockResolvedValue(undefined);
    mocks.createClient.mockResolvedValue(createSupabaseClient());
  });

  it("rejects a request without a board identifier", async () => {
    const response = await GET(request("/api/classes"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: "MISSING_PARAM" });
  });

  it("returns a cached class list after validating the board", async () => {
    mocks.getCached.mockResolvedValue(classes);

    const response = await GET(request("/api/classes?boardId=board-1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data: classes });
    expect(mocks.setCache).not.toHaveBeenCalled();
  });

  it("queries and caches classes on a cache miss", async () => {
    const response = await GET(request("/api/classes?boardId=board-1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data: classes });
    expect(mocks.setCache).toHaveBeenCalledWith("classes:board-1", classes, 86400);
  });
});
