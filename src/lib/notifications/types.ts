export type NotificationEventType =
  | "test_published"
  | "result_ready"
  | "weak_topic_detected"
  | "daily_quiz"
  | "streak_at_risk"
  | "inactive_3d"
  | "weekly_progress"
  | "exam_countdown"
  | "subscription_updated"
  | "account_security"
  | "announcement_published"
  | "parent_weekly_report";

export type NotificationChannel = "in_app" | "push" | "email" | "sms" | "whatsapp";
export type NotificationPriority = "critical" | "normal" | "low";
export type ChannelStatus =
  | "queued"
  | "accepted"
  | "delivered"
  | "failed"
  | "expired"
  | "rejected"
  | "retrying";
export type Locale = "en" | "hi" | "as";

export interface DomainEvent {
  id: string;
  event_type: NotificationEventType;
  actor_id?: string | null;
  target_user_id: string;
  payload: Record<string, unknown>;
  priority: NotificationPriority;
  idempotency_key: string;
  status: "queued" | "processing" | "completed" | "failed";
  scheduled_at?: string;
  processed_at?: string | null;
  created_at: string;
  retry_count: number;
  last_error?: string | null;
}

export interface NotificationRequest {
  user_id: string;
  event_type: NotificationEventType;
  title: string;
  body: string;
  localized_content?: Partial<Record<Locale, { title: string; body: string }>>;
  action_url?: string | null;
  priority: NotificationPriority;
  channel: NotificationChannel;
  category: string;
  notification_type?: string;
  idempotency_key: string;
}

export interface DeliveryResult {
  provider_message_id?: string;
  channel: NotificationChannel;
  status: ChannelStatus;
  retryable: boolean;
  error_category?: string;
  delivered_at?: string;
  metadata?: Record<string, unknown>;
}

export interface ChannelAdapter {
  name: string;
  channel: NotificationChannel;
  send(notification: NotificationRequest): Promise<DeliveryResult>;
  validate(notification: NotificationRequest): { valid: boolean; errors: string[] };
  handleFailure(error: Error | unknown, context?: Record<string, unknown>): Promise<DeliveryResult>;
  checkAvailability(): Promise<boolean>;
  getUsage(): Promise<Record<string, unknown>>;
  processWebhook?(payload: unknown): Promise<DeliveryResult>;
}

export interface NotificationPreference {
  user_id: string;
  timezone: string;
  quiet_hours_start: string;
  quiet_hours_end: string;
  channels: Partial<Record<NotificationChannel, boolean>>;
  categories: Record<string, boolean>;
  preferred_delivery_window_start: string;
  preferred_delivery_window_end: string;
  digest_mode: "off" | "daily" | "weekly";
  max_daily_non_critical: number;
}

export interface DeliveryAudit {
  event_id: string;
  notification_id?: string;
  channel: NotificationChannel;
  status: ChannelStatus;
  retry_count: number;
  provider_message_id?: string;
  error_category?: string;
  created_at: string;
}
