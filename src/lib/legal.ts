export const SUPER_ADMIN_PHONE = "+918876886919";
export const SUPER_ADMIN_EMAIL = "borahjayanta840@gmail.com";
export const ADMIN_PHONE = "+918876886919";
export const ADMIN_EMAIL = "biplopdasofficial1999@gmail.com";
export const SUPPORT_EMAIL = "xophal123@gmail.com";
export const SUPPORT_PHONE = SUPER_ADMIN_PHONE;
export const SUPPORT_ADDRESS = "Jorhat, Assam, India";
export const CONTACT_FORM_MAX_MESSAGE_LENGTH = 2000;

export const CONTACT_DETAILS: ReadonlyArray<{
  label: string;
  phone: string;
  email: string;
  whatsapp: string;
}> = [
  {
    label: "Support Team",
    phone: SUPER_ADMIN_PHONE,
    email: SUPPORT_EMAIL,
    whatsapp: SUPER_ADMIN_PHONE,
  },
  {
    label: "Admin Desk",
    phone: ADMIN_PHONE,
    email: ADMIN_EMAIL,
    whatsapp: ADMIN_PHONE,
  },
];

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
