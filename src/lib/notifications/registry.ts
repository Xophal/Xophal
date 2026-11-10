import type { ChannelAdapter, NotificationChannel, NotificationRequest } from "@/lib/notifications/types";

const adapterRegistry = new Map<NotificationChannel, ChannelAdapter>();

export function registerAdapter(adapter: ChannelAdapter) {
  adapterRegistry.set(adapter.channel, adapter);
  return adapter;
}

export function getAdapter(channel: NotificationChannel) {
  return adapterRegistry.get(channel) ?? null;
}

export function listAdapters() {
  return Array.from(adapterRegistry.values());
}

export function createPlaceholderAdapter(channel: NotificationChannel): ChannelAdapter {
  return {
    name: `${channel} adapter`,
    channel,
    async send(notification: NotificationRequest) {
      return {
        channel,
        status: "accepted",
        retryable: false,
        provider_message_id: `local-${notification.idempotency_key}`,
        metadata: { source: "placeholder" },
      };
    },
    validate(notification: NotificationRequest) {
      return {
        valid: Boolean(notification.user_id && notification.title && notification.body),
        errors: notification.user_id && notification.title && notification.body ? [] : ["Notification payload is incomplete."],
      };
    },
    async handleFailure(error) {
      return {
        channel,
        status: "failed",
        retryable: error instanceof Error && /timeout|rate|temporary/i.test(error.message),
        error_category: error instanceof Error ? "provider_error" : "unknown",
      };
    },
    async checkAvailability() {
      return true;
    },
    async getUsage() {
      return { channel, usage: 0 };
    },
  };
}

export function registerBuiltInChannels() {
  registerAdapter(createPlaceholderAdapter("in_app"));
  registerAdapter(createPlaceholderAdapter("push"));
  registerAdapter(createPlaceholderAdapter("email"));
  return listAdapters();
}

export function initializeDefaultAdapters() {
  return registerBuiltInChannels();
}
