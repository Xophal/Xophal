"use client";

import { useState } from "react";
import { Check, Copy, Facebook, Flag, MessageCircle, Share2, Twitter } from "lucide-react";

export function EbookShare({ title, description }: { title: string; description: string }) {
  const [copied, setCopied] = useState(false);
  const href = typeof window === "undefined" ? "" : window.location.href;
  const shareText = `${title} | Xophol`;

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Share this eBook">
      <span className="mr-1 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground"><Share2 className="h-4 w-4" />Share</span>
      <a className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:bg-muted" href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${href}`)}`} target="_blank" rel="noreferrer" aria-label="Share on WhatsApp" title="WhatsApp"><MessageCircle className="h-4 w-4" /></a>
      <a className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:bg-muted" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(href)}`} target="_blank" rel="noreferrer" aria-label="Share on Facebook" title="Facebook"><Facebook className="h-4 w-4" /></a>
      <a className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:bg-muted" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(href)}&description=${encodeURIComponent(description)}`} target="_blank" rel="noreferrer" aria-label="Share on X" title="X"><Twitter className="h-4 w-4" /></a>
      <button type="button" onClick={copyLink} className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-muted" aria-label="Copy eBook link"><Copy className="h-4 w-4" />{copied ? <><Check className="h-4 w-4" />Copied</> : "Copy link"}</button>
    </div>
  );
}

export function EbookReport({ ebookId }: { ebookId: string }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submitReport(formData: FormData) {
    setError("");
    const response = await fetch("/api/ebooks/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ebookId, reason: formData.get("reason"), details: formData.get("details") }),
    });
    if (!response.ok) {
      setError("We couldn't send that report. Please try again.");
      return;
    }
    setSent(true);
  }

  return (
    <details className="border-t border-border pt-4">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><Flag className="h-4 w-4" />Report this book</summary>
      {sent ? <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">Thank you. Your report has been sent for review.</p> : (
        <form action={submitReport} className="mt-3 grid gap-3">
          <label className="grid gap-1 text-sm">Reason<select name="reason" required className="h-10 rounded-md border border-input bg-background px-3"><option value="copyright">Copyright issue</option><option value="misleading">Misleading information</option><option value="broken_link">Broken external link</option><option value="inappropriate">Inappropriate content</option><option value="fraud">Fraud or scam</option><option value="other">Other</option></select></label>
          <label className="grid gap-1 text-sm">Details<textarea name="details" required minLength={10} maxLength={2000} rows={3} className="rounded-md border border-input bg-background p-3" placeholder="Tell us what needs review." /></label>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <button type="submit" className="min-h-10 w-fit rounded-md border border-border px-4 text-sm font-semibold hover:bg-muted">Send report</button>
        </form>
      )}
    </details>
  );
}
