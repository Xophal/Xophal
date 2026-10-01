import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  createClient: vi.fn(),
  query: {
    select: vi.fn(),
    eq: vi.fn(),
    limit: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { GET } from "@/app/api/student/leaderboard/route";

describe("student leaderboard route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.select.mockReturnValue(mocks.query);
    mocks.query.eq.mockReturnValue(mocks.query);
    mocks.query.limit.mockResolvedValue({ data: [{ rank: 3, total_xp: 120, tests_completed: 4 }], error: null });
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => mocks.query) });
    mocks.requireAuth.mockResolvedValue({ user: { id: "student-a" } });
  });

  it("requires authentication", async () => {
    mocks.requireAuth.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("queries only the signed-in student's leaderboard row", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.query.eq).toHaveBeenCalledWith("user_id", "student-a");
    expect(mocks.query.limit).toHaveBeenCalledWith(1);
    expect(body.data.entries).toHaveLength(1);
  });
});