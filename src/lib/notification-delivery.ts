import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

type DeliveryChannels = { email?: boolean; push?: boolean };
type NotificationContent = { title: string; message: string; link_url?: string | null };
type DeliveryProfile = {
  id: string;
  email: string;
  full_name: string | null;
  email_verified: boolean;
  settings: { email_notifications?: boolean; push_notifications?: boolean } | null;
};

type ChannelResult = {
  attempted: number;
  accepted: number;
  failed: number;
  error?: string;
};

export type NotificationDeliveryResult = {
  email: ChannelResult;
  push: ChannelResult;
};

const emptyResult = (): ChannelResult => ({ attempted: 0, accepted: 0, failed: 0 });

export async function deliverNotificationToUsers(
  userIds: string[],
  notification: NotificationContent,
  channels: DeliveryChannels
): Promise<NotificationDeliveryResult> {
  const result: NotificationDeliveryResult = { email: emptyResult(), push: emptyResult() };
  const recipients = [...new Set(userIds)].filter(Boolean);
  if (!recipients.length || (!channels.email && !channels.push)) return result;

  const admin = createAdminClient();
  const profiles: DeliveryProfile[] = [];
  for (const batch of chunk(recipients, 500)) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, email, full_name, email_verified, settings")
      .in("id", batch);
    if (error) {
      result.email.error = error.message;
      result.push.error = error.message;
      return result;
    }
    profiles.push(...(data || []));
  }

  if (channels.email) {
    const emailRecipients = selectEmailRecipients(profiles);
    result.email.attempted = emailRecipients.length;
    await sendEmails(emailRecipients, notification, result.email);
  }

  if (channels.push) {
    const pushRecipients = selectPushRecipientIds(profiles);
    const subscriptions: { user_id: string; endpoint: string; p256dh: string; auth: string }[] = [];
    for (const batch of chunk(pushRecipients, 500)) {
      const { data, error } = await admin
        .from("push_subscriptions")
        .select("user_id, endpoint, p256dh, auth")
        .in("user_id", batch);
      if (error) {
        result.push.error = error.message;
        break;
      }
      subscriptions.push(...(data || []));
    }

    if (!result.push.error) {
      result.push.attempted = subscriptions.length;
      await sendPush(subscriptions, notification, result.push);
    }
  }

  return result;
}

export function selectEmailRecipients<T extends Pick<DeliveryProfile, "email_verified" | "settings">>(profiles: T[]) {
  return profiles.filter((profile) => profile.email_verified && profile.settings?.email_notifications !== false);
}

export function selectPushRecipientIds<T extends Pick<DeliveryProfile, "id" | "settings">>(profiles: T[]) {
  return profiles.filter((profile) => profile.settings?.push_notifications === true).map((profile) => profile.id);
}

async function sendEmails(
  recipients: { email: string; full_name: string | null }[],
  notification: NotificationContent,
  result: ChannelResult
) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!recipients.length) return;
  if (!apiKey || !from) {
    result.failed = recipients.length;
    result.error = "Email delivery is not configured (RESEND_API_KEY and RESEND_FROM).";
    return;
  }

  const batches = chunk(recipients, 100);
  for (const batch of batches) {
    try {
      const response = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(batch.map((recipient) => ({
          from,
          to: [recipient.email],
          subject: notification.title,
          html: renderNotificationEmail(recipient.full_name, notification),
        }))),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`Resend rejected the batch (${response.status}).`);
      result.accepted += batch.length;
    } catch (error) {
      result.failed += batch.length;
      if (error instanceof Error && error.name === "AbortError") {
        result.error = "Resend email delivery timed out.";
      } else {
        result.error = error instanceof Error ? error.message : "Email delivery failed.";
      }
    }
  }
}

async function sendPush(
  subscriptions: { user_id: string; endpoint: string; p256dh: string; auth: string }[],
  notification: NotificationContent,
  result: ChannelResult
) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!subscriptions.length) return;
  if (!publicKey || !privateKey || !subject) {
    result.failed = subscriptions.length;
    result.error = "Push delivery is not configured (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT).";
    return;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch (error) {
    result.failed = subscriptions.length;
    result.error = error instanceof Error ? error.message : "VAPID configuration is invalid.";
    return;
  }

  const admin = createAdminClient();
  const payload = JSON.stringify({ title: notification.title, body: notification.message, url: resolveNotificationUrl(notification.link_url) });
  for (const batch of chunk(subscriptions, 50)) {
    const settled = await Promise.allSettled(batch.map((subscription) =>
      webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        payload
      )
    ));

    for (const [index, delivery] of settled.entries()) {
      if (delivery.status === "fulfilled") {
        result.accepted += 1;
        continue;
      }
      result.failed += 1;
      result.error = delivery.reason instanceof Error ? delivery.reason.message : "Push delivery failed.";
      const statusCode = (delivery.reason as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("endpoint", batch[index].endpoint);
      }
    }
  }
}

function renderNotificationEmail(name: string | null, notification: NotificationContent) {
  const greeting = name ? `Hello ${escapeHtml(name)},` : "Hello,";
  const link = resolveNotificationUrl(notification.link_url);
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:600px;margin:auto"><p>${greeting}</p><h1 style="font-size:22px">${escapeHtml(notification.title)}</h1><p>${escapeHtml(notification.message)}</p><p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 16px;background:#0b4cc2;color:#fff;text-decoration:none;border-radius:6px">Open Xophol</a></p><p style="font-size:12px;color:#667085">You received this because email notifications are enabled in your Xophol account settings.</p></div>`;
}

export function resolveNotificationUrl(value?: string | null) {
  const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL || "https://www.xophol.com");
  if (!value) return new URL("/notifications", appUrl).href;
  try {
    const url = value.startsWith("/") ? new URL(value, appUrl) : new URL(value);
    return url.origin === appUrl.origin && (url.protocol === "https:" || appUrl.protocol === "http:")
      ? url.href
      : new URL("/notifications", appUrl).href;
  } catch {
    return new URL("/notifications", appUrl).href;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}