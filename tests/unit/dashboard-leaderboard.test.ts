import { describe, expect, it } from "vitest";
import { mergeLeaderboardRows, resolveLeaderboardScope } from "@/lib/dashboard/leaderboard";

describe("dashboard leaderboard", () => {
  it("uses the student's board and class outside the global period", () => {
    const profile = { board_id: "board-1", class_id: "class-10" };

    const expected = { boardId: "board-1", classId: "class-10" };
    expect(resolveLeaderboardScope("weekly", profile)).toEqual(expected);
    expect(resolveLeaderboardScope("monthly", profile)).toEqual(expected);
    expect(resolveLeaderboardScope("exam", profile)).toEqual(expected);
  });

  it("uses the unscoped cohort for the global period", () => {
    expect(resolveLeaderboardScope("global", { board_id: "board-1", class_id: "class-10" })).toEqual({
      boardId: null,
      classId: null,
    });
  });

  it("retains the student's own rank when it is outside the top five", () => {
    const topFive = Array.from({ length: 5 }, (_, index) => ({ user_id: `student-${index + 1}` }));
    const ownRow = { user_id: "current-student" };
    const rows = mergeLeaderboardRows(topFive, ownRow);

    expect(rows).toHaveLength(6);
    expect(rows.at(-1)).toEqual(ownRow);
  });
});