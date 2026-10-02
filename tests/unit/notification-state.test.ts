import { describe, expect, it } from "vitest";
import { applyNotificationReceipts } from "@/lib/notification-state";

describe("applyNotificationReceipts", () => {
  it("applies per-user read state to global notifications without changing personal state", () => {
    const notifications = [
      { id: "global-read", is_global: true, is_read: false },
      { id: "global-new", is_global: true, is_read: false },
      { id: "personal", is_global: false, is_read: true },
    ];

    expect(
      applyNotificationReceipts(notifications, [
        { notification_id: "global-read", is_read: true, is_dismissed: false },
      ])
    ).toEqual([
      { id: "global-read", is_global: true, is_read: true },
      { id: "global-new", is_global: true, is_read: false },
      { id: "personal", is_global: false, is_read: true },
    ]);
  });

  it("hides dismissed global notifications", () => {
    expect(
      applyNotificationReceipts(
        [{ id: "dismissed", is_global: true, is_read: false }],
        [{ notification_id: "dismissed", is_read: true, is_dismissed: true }]
      )
    ).toEqual([]);
  });
});