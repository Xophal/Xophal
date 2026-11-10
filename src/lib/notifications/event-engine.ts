import { createHash } from "node:crypto";

import type { DomainEvent, NotificationEventType, NotificationPriority, NotificationRequest } from "@/lib/notifications/types";

const EVENT_TYPE_ORDER: Record<NotificationEventType, number> = {
  test_published: 1,
  result_ready: 3,
  weak_topic_detected: 1,
  daily_quiz: 1,
  streak_at_risk: 1,
  inactive_3d: 1,
  weekly_progress: 2,
  exam_countdown: 2,
  subscription_updated: 3,
  account_security: 3,
  announcement_published: 2,
  parent_weekly_report: 2,
};

export function createIdempotencyKey(seed: string): string {
  return createHash("sha256").update(seed).digest("hex");
}

export function normalizePriority(eventType: NotificationEventType): NotificationPriority {
  const order = EVENT_TYPE_ORDER[eventType] ?? 1;
  if (eventType === "result_ready" || eventType === "account_security" || eventType === "subscription_updated") {
    return "critical";
  }
  return order >= 3 ? "normal" : "low";
}

export function buildDomainEvent(input: {
  event_type: NotificationEventType;
  target_user_id: string;
  payload: Record<string, unknown>;
  actor_id?: string | null;
  scheduled_at?: string;
  created_at?: string;
  retry_count?: number;
  last_error?: string | null;
}): DomainEvent {
  const createdAt = input.created_at ?? new Date().toISOString();
  const eventId = createIdempotencyKey(`${input.event_type}:${input.target_user_id}:${createdAt}:${JSON.stringify(input.payload)}`);

  return {
    id: eventId,
    event_type: input.event_type,
    actor_id: input.actor_id ?? null,
    target_user_id: input.target_user_id,
    payload: input.payload,
    priority: normalizePriority(input.event_type),
    idempotency_key: createIdempotencyKey(`${input.event_type}:${input.target_user_id}:${JSON.stringify(input.payload)}`),
    status: "queued",
    scheduled_at: input.scheduled_at,
    processed_at: null,
    created_at: createdAt,
    retry_count: input.retry_count ?? 0,
    last_error: input.last_error ?? null,
  };
}

export function isDuplicateEvent(existingKey: string | null | undefined, newKey: string): boolean {
  return Boolean(existingKey && existingKey === newKey);
}

export function createNotificationRequest(input: {
  user_id: string;
  event_type: NotificationEventType;
  title: string;
  body: string;
  action_url?: string | null;
  channel: NotificationRequest["channel"];
  category: string;
  priority?: NotificationPriority;
  localized_content?: NotificationRequest["localized_content"];
  idempotency_key?: string;
}): NotificationRequest {
  return {
    user_id: input.user_id,
    event_type: input.event_type,
    title: input.title,
    body: input.body,
    action_url: input.action_url ?? null,
    channel: input.channel,
    category: input.category,
    priority: input.priority ?? normalizePriority(input.event_type),
    localized_content: input.localized_content,
    idempotency_key: input.idempotency_key ?? createIdempotencyKey(`${input.user_id}:${input.event_type}:${input.title}:${input.body}`),
  };
}
