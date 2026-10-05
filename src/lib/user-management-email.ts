import { randomBytes, createHash } from "node:crypto";
import { APP_NAME, APP_URL } from "@/constants";
import { ApiError } from "@/lib/api-utils";

const ROLE_INVITATION_TTL_DAYS = 7;

export function createRoleInvitationToken() {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashRoleInvitationToken(token) };
}

export function hashRoleInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getRoleInvitationExpiry() {
  return new Date(Date.now() + ROLE_INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export async function sendRoleInvitationEmail(input: {
  email: string;
  fullName: string | null;
  roleName: string;
  token: string;
}) {
  const recipient = input.email.trim();
  const actionUrl = new URL("/account/role-invitation", `${APP_URL.replace(/\/+$/, "")}/`);
  actionUrl.searchParams.set("token", input.token);
  await sendEmail({
    to: recipient,
    subject: `${APP_NAME}: role invitation`,
    html: `<p>Hello ${escapeHtml(input.fullName || "there")},</p><p>A super administrator has invited you to use the <strong>${escapeHtml(input.roleName)}</strong> role on ${APP_NAME}.</p><p>Your current role will not change unless you accept this invitation. You can accept or reject it using the buttons below. This link expires in ${ROLE_INVITATION_TTL_DAYS} days.</p><p><a href="${escapeHtml(actionUrl.toString())}">Review role invitation</a></p><p>If you were not expecting this invitation, you can safely ignore this email.</p>`,
  });
}

export async function sendAccountStatusEmail(input: {
  email: string;
  fullName: string | null;
  isActive: boolean;
}) {
  const state = input.isActive ? "activated" : "deactivated";
  const explanation = input.isActive
    ? "You can sign in to your account again."
    : "Sign-in to your account is currently blocked. Your account data has not been deleted.";
  await sendEmail({
    to: input.email.trim(),
    subject: `${APP_NAME}: account ${state}`,
    html: `<p>Hello ${escapeHtml(input.fullName || "there")},</p><p>Your ${APP_NAME} account has been ${state} by a super administrator.</p><p>${explanation}</p><p>If you believe this was a mistake, contact the ${APP_NAME} support team.</p>`,
  });
}

async function sendEmail(input: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    throw new ApiError(503, "Email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM.", "USER_EMAIL_NOT_CONFIGURED");
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    const timeout = error instanceof Error && error.name === "AbortError";
    console.error("User management email delivery failed", { error, timedOut: timeout });
    throw new ApiError(
      timeout ? 504 : 502,
      timeout ? "Email delivery timed out. Please try again." : "Email delivery failed. Please try again.",
      timeout ? "USER_EMAIL_TIMEOUT" : "USER_EMAIL_FAILED"
    );
  }

  if (response.ok) return;
  let providerDetail = "";
  try {
    const body = await response.json() as { message?: string; error?: string };
    providerDetail = body.message || body.error || "";
  } catch {
    providerDetail = "";
  }
  console.error("User management email provider rejected the request", {
    status: response.status,
    detail: providerDetail,
  });
  throw new ApiError(502, "Email delivery failed. Please try again.", "USER_EMAIL_FAILED");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] || character);
}
