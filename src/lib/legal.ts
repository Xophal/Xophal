export const SUPPORT_EMAIL = "support@xophal.in";
export const SUPPORT_PHONE = "+91 98765 43210";
export const SUPPORT_ADDRESS = "Bhubaneswar, Odisha, India";
export const CONTACT_FORM_MAX_MESSAGE_LENGTH = 2000;

export function sanitizeContactInput(value: string, maxLength = CONTACT_FORM_MAX_MESSAGE_LENGTH) {
  const stripped = value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return stripped.length > maxLength ? stripped.slice(0, maxLength).trim() : stripped;
}

export function buildSupportMailto({ name, email, message }: { name: string; email: string; message: string }) {
  const subject = encodeURIComponent(`Support request from ${name || "student"}`);
  const body = encodeURIComponent(
    [
      `Name: ${name}`,
      `Email: ${email}`,
      "",
      "Message:",
      message,
    ].join("\n")
  );

  return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
}
