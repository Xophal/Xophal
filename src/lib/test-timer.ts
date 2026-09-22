export const DEFAULT_TIMER_WARNING_SECONDS = 60;

export function getAttemptExpiresAt(startedAt: number, durationMinutes: number): number | null {
  if (!Number.isFinite(startedAt) || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return null;
  }

  return startedAt + Math.floor(durationMinutes * 60 * 1000);
}

export function getRemainingSeconds(expiresAt: number | null, now = Date.now()): number {
  if (!expiresAt || !Number.isFinite(expiresAt)) return 0;
  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

export function formatTestTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}
