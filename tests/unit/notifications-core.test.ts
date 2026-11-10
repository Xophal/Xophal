import { describe, expect, it } from "vitest";

import {
  buildDomainEvent,
  canSendNotification,
  createIdempotencyKey,
  createNotificationRequest,
  getAdapter,
  getTemplateForEvent,
  initializeDefaultAdapters,
  isDuplicateEvent,
  isWithinQuietHours,
  normalizeNotificationActionUrl,
  normalizeNotificationPreferences,
  notificationPayloadSchema,
  notificationPreferencesSchema,
  renderTemplate,
  validateTemplateVariables,
} from "@/lib/notifications";

describe("notification core", () => {
  it("builds a stable idempotency key and event payload", () => {
    const event = buildDomainEvent({
      event_type: "result_ready",
      target_user_id: "user-1",
      payload: { attempt_id: "attempt-42" },
      actor_id: "admin-1",
    });

    expect(event.priority).toBe("critical");
    expect(event.status).toBe("queued");
    expect(event.id).toBe(createIdempotencyKey(`${event.event_type}:${event.target_user_id}:${event.created_at}:${JSON.stringify(event.payload)}`));
    expect(event.idempotency_key).toBeTruthy();
  });

  it("detects duplicate events and blocks duplicates", () => {
    const key = "duplicate-event";
    expect(isDuplicateEvent(key, key)).toBe(true);
    expect(isDuplicateEvent(null, key)).toBe(false);
  });

  it("renders safe localized templates and validates variables", () => {
    const rendered = renderTemplate("result_ready", "hi", {
      score: 82,
      test_name: "Unit Test",
      action_url: "/tests/123",
    });

    expect(rendered.title).toContain("परिणाम");
    expect(rendered.body).toContain("स्कोर");

    const validation = validateTemplateVariables("result_ready", "en", {
      score: 82,
      test_name: "Unit Test",
      action_url: "/tests/123",
    });
    expect(validation.valid).toBe(true);
    expect(validation.missing).toEqual([]);

    const template = getTemplateForEvent("result_ready", "en");
    expect(template.title).toBe("Result ready");
  });

  it("enforces quiet hours and frequency caps", () => {
    const quiet = isWithinQuietHours(new Date("2026-11-11T23:30:00+05:30"), "Asia/Kolkata", "22:00", "07:00");
    expect(quiet).toBe(true);

    expect(canSendNotification({ priority: "low", sentCountToday: 2, limit: 3 })).toBe(true);
    expect(canSendNotification({ priority: "low", sentCountToday: 3, limit: 3 })).toBe(false);
    expect(canSendNotification({ priority: "critical", sentCountToday: 99 })).toBe(true);
  });

  it("creates a channel-safe notification request", () => {
    const request = createNotificationRequest({
      user_id: "user-123",
      event_type: "test_published",
      title: "New test",
      body: "Your class has a new practice test.",
      channel: "in_app",
      category: "tests",
    });

    expect(request.priority).toBe("low");
    expect(request.idempotency_key).toMatch(/^[a-f0-9]{64}$/);
    expect(request.channel).toBe("in_app");
  });

  it("validates payloads and sanitizes safe action URLs", () => {
    const parsed = notificationPayloadSchema.parse({
      title: "Result published",
      message: "Your mock test results are ready.",
      type: "success",
      link_url: "/results/123",
      user_ids: ["123e4567-e89b-12d3-a456-426614174000"],
      is_global: false,
    });

    expect(parsed.link_url).toBe("/results/123");
    expect(normalizeNotificationActionUrl("https://example.com/results/123")).toBe("https://example.com/results/123");
    expect(normalizeNotificationActionUrl("javascript:alert(1)")).toBeNull();
    expect(() => notificationPayloadSchema.parse({
      title: "",
      message: "A message",
      user_ids: [],
    })).toThrow();
  });

  it("registers default channel adapters for the notification engine", () => {
    const adapters = initializeDefaultAdapters();
    expect(adapters.some((adapter) => adapter.channel === "in_app")).toBe(true);
    expect(getAdapter("email")?.name).toBe("email adapter");
  });

  it("normalizes notification preferences and validates the schema", () => {
    const preferences = normalizeNotificationPreferences({
      user_id: "123e4567-e89b-12d3-a456-426614174000",
      timezone: "Asia/Kolkata",
      categories: { results: true, reminders: false },
      channels: { in_app: true, push: true, email: false, sms: false, whatsapp: false },
      digest_mode: "daily",
      max_daily_non_critical: 5,
    });

    expect(preferences.channels.in_app).toBe(true);
    expect(preferences.channels.push).toBe(true);
    expect(preferences.digest_mode).toBe("daily");
    expect(notificationPreferencesSchema.parse(preferences).channels.email).toBe(false);
    expect(normalizeNotificationPreferences({ categories: { "   ": true } }).categories["   "]).toBeUndefined();
  });
});
