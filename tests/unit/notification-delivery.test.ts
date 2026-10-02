import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveNotificationUrl, selectEmailRecipients, selectPushRecipientIds } from "@/lib/notification-delivery";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("notification delivery preferences", () => {
  const profiles = [
    { id: "verified-default", email_verified: true, settings: {} },
    { id: "email-opted-out", email_verified: true, settings: { email_notifications: false } },
    { id: "unverified", email_verified: false, settings: {} },
    { id: "push-enabled", email_verified: true, settings: { push_notifications: true } },
  ];

  it("emails only verified recipients who have not opted out", () => {
    expect(selectEmailRecipients(profiles).map(({ id }) => id)).toEqual(["verified-default", "push-enabled"]);
  });

  it("sends push only to explicitly opted-in recipients", () => {
    expect(selectPushRecipientIds(profiles)).toEqual(["push-enabled"]);
  });
});

describe("resolveNotificationUrl", () => {
  it("resolves relative destinations against the canonical app URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.xophol.com");
    expect(resolveNotificationUrl("/test/result/attempt-1")).toBe("https://app.xophol.com/test/result/attempt-1");
  });

  it("rejects external and non-http destinations", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.xophol.com");
    expect(resolveNotificationUrl("https://evil.example/collect")).toBe("https://app.xophol.com/notifications");
    expect(resolveNotificationUrl("javascript:alert(1)")).toBe("https://app.xophol.com/notifications");
  });
});