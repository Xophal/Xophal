import type { LeaderboardPeriod } from "./queries";

export type LeaderboardScope = {
  boardId: string | null;
  classId: string | null;
};

type LeaderboardProfileScope =
  | { boardId: string | null; classId: string | null }
  | { board_id: string | null; class_id: string | null };

export function resolveLeaderboardScope(
  period: LeaderboardPeriod,
  profile: LeaderboardProfileScope
): LeaderboardScope {
  const boardId = "boardId" in profile ? profile.boardId : profile.board_id;
  const classId = "classId" in profile ? profile.classId : profile.class_id;

  return period === "global"
    ? { boardId: null, classId: null }
    : { boardId, classId };
}

export function mergeLeaderboardRows<T extends { user_id: string }>(rows: readonly T[], currentUserRow: T | null): T[] {
  const byUser = new Map(rows.map((row) => [row.user_id, row]));
  if (currentUserRow) byUser.set(currentUserRow.user_id, currentUserRow);
  return [...byUser.values()];
}