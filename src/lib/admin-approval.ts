import { ApiError } from "@/lib/api-utils";

export function getMainAdminEmails() {
  return (process.env.MAIN_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isMainAdminEmail(email: string | null | undefined) {
  return Boolean(email && getMainAdminEmails().includes(email.trim().toLowerCase()));
}

export function assertAdminApprovalConfigured() {
  const mainAdminEmails = getMainAdminEmails();
  if (mainAdminEmails.length !== 2) {
    throw new ApiError(503, "Admin approval is not configured. Set MAIN_ADMIN_EMAILS to exactly two email addresses.", "ADMIN_APPROVAL_NOT_CONFIGURED");
  }
}

export function assertMainAdminEmail(email: string | null | undefined) {
  assertAdminApprovalConfigured();
  if (!isMainAdminEmail(email)) {
    throw new ApiError(403, "Only a main administrator can review admin signup requests.", "FORBIDDEN");
  }
}

export async function sendAdminApprovalRequest(input: { email: string; fullName: string; requestedRole: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const recipients = getMainAdminEmails();

  if (!apiKey || !from || recipients.length !== 2) {
    throw new ApiError(503, "Admin approval email is not configured. Set MAIN_ADMIN_EMAILS, RESEND_API_KEY, and RESEND_FROM.", "ADMIN_EMAIL_NOT_CONFIGURED");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: "Xophal admin signup approval required",
      html: `<p>A new admin signup request needs review.</p><p><strong>Name:</strong> ${escapeHtml(input.fullName)}<br/><strong>Email:</strong> ${escapeHtml(input.email)}<br/><strong>Requested role:</strong> ${escapeHtml(input.requestedRole)}</p><p><a href="${escapeHtml(appUrl)}/admin/admin-requests">Review admin request</a></p>`,
    }),
  });

  if (!response.ok) {
    let providerDetail = "";
    try {
      const body = await response.json() as { message?: string; error?: string };
      providerDetail = body.message || body.error || "";
    } catch {
      providerDetail = "";
    }
    console.error("Admin approval email provider rejected the request", { status: response.status, detail: providerDetail });
    throw new ApiError(502, "The admin approval request was created, but notification email could not be sent.", "ADMIN_EMAIL_FAILED");
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}