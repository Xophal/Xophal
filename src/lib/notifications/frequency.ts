import type { NotificationPriority } from "@/lib/notifications/types";

export function isWithinQuietHours(currentTime: Date, timezone: string, quietHoursStart = "22:00", quietHoursEnd = "07:00") {
  void timezone;
  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  const currentMinutes = hours * 60 + minutes;

  const [startHour, startMinute] = quietHoursStart.split(":").map(Number);
  const [endHour, endMinute] = quietHoursEnd.split(":").map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

export function canSendNotification({
  priority,
  sentCountToday,
  limit = 3,
}: {
  priority: NotificationPriority;
  sentCountToday: number;
  limit?: number;
}) {
  if (priority === "critical") {
    return true;
  }

  return sentCountToday < limit;
}

export function buildRetryBackoff(attempt: number) {
  const baseSchedule = [0, 60_000, 300_000, 900_000, 3_600_000];
  const waitMs = baseSchedule[Math.min(attempt - 1, baseSchedule.length - 1)] ?? baseSchedule[baseSchedule.length - 1];

  const jitter = Math.floor(Math.random() * 30_000);
  return waitMs + jitter;
}
