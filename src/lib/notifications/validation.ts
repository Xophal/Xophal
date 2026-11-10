import { z } from "zod";

export const notificationPayloadSchema = z.object({
  title: z.string().trim().min(1).max(500),
  message: z.string().trim().min(1).max(10_000),
  type: z.enum(["info", "success", "warning", "announcement"]).default("info"),
  link_url: z.string().trim().max(2048).nullable().default(null).refine((value) => {
    if (!value) return true;
    if (value.startsWith("/")) return !value.startsWith("//") && !value.includes("\\");
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Link must be a safe internal path or an HTTP(S) URL."),
  user_ids: z.array(z.string().uuid()).max(500).default([]),
  is_global: z.boolean().default(false),
});

export const notificationDecisionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["mark_read", "dismiss", "delete"]).default("mark_read"),
});

export const notificationReadSchema = z.object({
  id: z.string().uuid(),
});

export const notificationBulkReadSchema = z.object({
  ids: z.array(z.string().uuid()).max(500).default([]),
});

export const notificationPreferencesSchema = z.object({
  user_id: z.string().uuid().optional(),
  timezone: z.string().trim().min(1).max(100).default("Asia/Kolkata"),
  quiet_hours_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("22:00"),
  quiet_hours_end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("07:00"),
  channels: z.object({
    in_app: z.boolean().default(true),
    push: z.boolean().default(false),
    email: z.boolean().default(false),
    sms: z.boolean().default(false),
    whatsapp: z.boolean().default(false),
  }).default({
    in_app: true,
    push: false,
    email: false,
    sms: false,
    whatsapp: false,
  }),
  categories: z.record(z.string().min(1).max(64), z.boolean()).default({}),
  preferred_delivery_window_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("09:00"),
  preferred_delivery_window_end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("20:00"),
  digest_mode: z.enum(["off", "daily", "weekly"]).default("off"),
  max_daily_non_critical: z.number().int().min(0).max(50).default(3),
});

export function normalizeNotificationActionUrl(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) {
    return trimmed.startsWith("//") || trimmed.includes("\\") ? null : trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    return ["http:", "https:"].includes(parsed.protocol) ? trimmed : null;
  } catch {
    return null;
  }
}

export function normalizeNotificationPreferences(input: Partial<z.infer<typeof notificationPreferencesSchema>> = {}) {
  const parsed = notificationPreferencesSchema.parse({
    timezone: "Asia/Kolkata",
    quiet_hours_start: "22:00",
    quiet_hours_end: "07:00",
    preferred_delivery_window_start: "09:00",
    preferred_delivery_window_end: "20:00",
    digest_mode: "off",
    max_daily_non_critical: 3,
    ...input,
    channels: {
      in_app: true,
      push: false,
      email: false,
      sms: false,
      whatsapp: false,
      ...input.channels,
    },
    categories: input.categories ?? {},
  });

  const normalizedCategories: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(parsed.categories ?? {})) {
    const categoryKey = key.trim();
    if (categoryKey.length > 0) {
      normalizedCategories[categoryKey] = Boolean(value);
    }
  }

  return {
    ...parsed,
    channels: {
      in_app: Boolean(parsed.channels.in_app),
      push: Boolean(parsed.channels.push),
      email: Boolean(parsed.channels.email),
      sms: Boolean(parsed.channels.sms),
      whatsapp: Boolean(parsed.channels.whatsapp),
    },
    categories: normalizedCategories,
  };
}
