"use client";

import { useMemo, useState } from "react";
import { Facebook, Instagram, MapPin, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTACT_FORM_MAX_MESSAGE_LENGTH, CONTACT_DETAILS, SUPPORT_ADDRESS, SUPPORT_EMAIL, SUPPORT_PHONE, phoneHref, buildSupportMailto, sanitizeContactInput } from "@/lib/legal";

const socialLinks = [
  { name: "Telegram", href: "https://t.me/xopholstudent", icon: MessageCircle },
  { name: "Instagram", href: "https://www.instagram.com/xopholofficial", icon: Instagram },
  { name: "Facebook", href: "https://www.facebook.com/share/195Xu881nV/", icon: Facebook },
];

export function ContactPageClient() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; message?: string }>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const remaining = useMemo(() => CONTACT_FORM_MAX_MESSAGE_LENGTH - message.length, [message.length]);

  function validate() {
    const nextErrors: { name?: string; email?: string; message?: string } = {};
    const safeName = sanitizeContactInput(name, 120);
    const safeEmail = email.trim();
    const safeMessage = sanitizeContactInput(message, CONTACT_FORM_MAX_MESSAGE_LENGTH);

    if (!safeName) nextErrors.name = "Please enter your name.";
    if (!safeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) nextErrors.email = "Please enter a valid email address.";
    if (!safeMessage) nextErrors.message = "Please tell us how we can help.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("idle");

    const safeName = sanitizeContactInput(name, 120);
    const safeEmail = email.trim();
    const safeMessage = sanitizeContactInput(message, CONTACT_FORM_MAX_MESSAGE_LENGTH);

    const nextErrors: { name?: string; email?: string; message?: string } = {};
    if (!safeName) nextErrors.name = "Please enter your name.";
    if (!safeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) nextErrors.email = "Please enter a valid email address.";
    if (!safeMessage) nextErrors.message = "Please tell us how we can help.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStatus("error");
      return;
    }

    try {
      setStatus("loading");
      await new Promise((resolve) => setTimeout(resolve, 400));
      window.location.href = buildSupportMailto({ name: safeName, email: safeEmail, message: safeMessage });
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Contact support</p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">We’re here to help.</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Reach out for account questions, course or mock-test issues, or platform support requests.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <aside className="rounded-3xl border bg-card p-6 shadow-sm">
          <div className="space-y-5">
            <div>
              <p className="font-semibold">Email</p>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sm text-muted-foreground hover:text-foreground">
                {SUPPORT_EMAIL}
              </a>
            </div>

            <div>
              <p className="font-semibold">Phone / WhatsApp</p>
              <a href={phoneHref(SUPPORT_PHONE)} className="text-sm text-muted-foreground hover:text-foreground">
                {SUPPORT_PHONE}
              </a>
            </div>

            {CONTACT_DETAILS.map((contact) => (
              <div key={contact.label} className="rounded-xl border bg-background/50 p-3">
                <p className="text-sm font-semibold">{contact.label}</p>
                <a href={phoneHref(contact.phone)} className="mt-1 block text-sm text-muted-foreground hover:text-foreground">
                  {contact.phone}
                </a>
                <a href={contact.whatsapp} target="_blank" rel="noreferrer" className="mt-1 block text-sm text-primary hover:underline">
                  WhatsApp {contact.label}
                </a>
                <a href={`mailto:${contact.email}`} className="mt-1 block text-sm text-muted-foreground hover:text-foreground">
                  {contact.email}
                </a>
              </div>
            ))}

            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">Address</p>
                <p className="text-sm text-muted-foreground">{SUPPORT_ADDRESS}</p>
              </div>
            </div>

            <div className="pt-2">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Follow us</h2>
              <div className="mt-3 flex items-center gap-3">
                {socialLinks.map(({ name, href, icon: Icon }) => (
                  <a
                    key={name}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={name}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md border bg-transparent text-muted-foreground hover:border-primary hover:text-foreground"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <form onSubmit={handleSubmit} noValidate className="rounded-3xl border bg-card p-6 shadow-sm">
          <div className="space-y-5">
            <div>
              <label htmlFor="name" className="mb-2 block text-sm font-medium">Your name</label>
              <input
                id="name"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2.5 text-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Your full name"
                aria-invalid={Boolean(errors.name)}
                maxLength={120}
              />
              {errors.name && <p className="mt-2 text-sm text-destructive">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2.5 text-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="name@example.com"
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && <p className="mt-2 text-sm text-destructive">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="message" className="mb-2 block text-sm font-medium">Message</label>
              <textarea
                id="message"
                name="message"
                rows={7}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2.5 text-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Tell us what you need help with"
                aria-invalid={Boolean(errors.message)}
                maxLength={CONTACT_FORM_MAX_MESSAGE_LENGTH}
              />
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{errors.message ?? "We do not publish submitted messages publicly."}</span>
                <span aria-live="polite">{remaining} chars left</span>
              </div>
            </div>

            {status === "success" && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Your message is ready to be sent via email. Please review the mail app window if it opens.
              </div>
            )}

            {status === "error" && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                Please fix the highlighted fields and try again.
              </div>
            )}

            <div className="flex items-center justify-end">
              <Button type="submit" disabled={status === "loading"} className="min-w-36">
                {status === "loading" ? "Sending…" : "Send message"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
