export const SUPER_ADMIN_PHONE = "";
export const SUPER_ADMIN_EMAIL = "";
export const ADMIN_PHONE = "";
export const ADMIN_EMAIL = "";
export const SUPPORT_EMAIL = "support@xophol.com";
export const SUPPORT_PHONE = "";
export const SUPPORT_ADDRESS = "Jorhat, Assam, India";
export const CONTACT_FORM_MAX_MESSAGE_LENGTH = 2000;

export const CONTACT_DETAILS: ReadonlyArray<{
  label: string;
  phone: string;
  email: string;
  whatsapp: string;
}> = [];

export function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}

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
