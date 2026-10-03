"use client";

import { useState } from "react";
import { Check, Copy, Facebook, Flag, MessageCircle, Share2, Twitter } from "lucide-react";

export function EbookShare({
  ebookId,
  title,
  description,
  canonicalUrl,
}: {
  ebookId: string;
  title: string;
  description: string;
  canonicalUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const shareText = `Check out this study resource on Xophol: ${title}`;

  function trackShare(platform: string) {
    void fetch("/api/ebooks/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        eventName: "ebook_share_clicked",
        ebookId,
        source: "ebook_detail",
        metadata: { sharePlatform: platform },
      }),
    }).then((response) => {
      if (!response.ok) throw new Error(`Share tracking returned HTTP ${response.status}`);
    }).catch((trackingError: unknown) => {
      console.error("Could not record eBook share event", trackingError);
    });
  }

  async function copyLink() {
    setError("");
    try {
      await navigator.clipboard.writeText(canonicalUrl);
      setCopied(true);
      trackShare("copy_link");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy the link. Please try sharing it another way.");
    }
  }

  async function shareNatively() {
    setError("");
    if (typeof navigator.share !== "function") {
      setError("Device sharing is not available in this browser. Copy the link instead.");
      return;
    }
    try {
      await navigator.share({ title, text: shareText, url: canonicalUrl });
      trackShare("web_share");
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      setError("Could not open the share menu. Please try another share option.");
    }
  }

  return (
    <div>
      <div role="group" aria-label="Share this eBook" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground"><Share2 className="h-4 w-4" />Share</span>
        <a onClick={() => trackShare("whatsapp")} className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${canonicalUrl}`)}`} target="_blank" rel="noopener noreferrer nofollow" aria-label="Share on WhatsApp" title="WhatsApp"><MessageCircle className="h-4 w-4" /></a>
        <a onClick={() => trackShare("facebook")} className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonicalUrl)}`} target="_blank" rel="noopener noreferrer nofollow" aria-label="Share on Facebook" title="Facebook"><Facebook className="h-4 w-4" /></a>
        <a onClick={() => trackShare("x")} className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(canonicalUrl)}&description=${encodeURIComponent(description)}`} target="_blank" rel="noopener noreferrer nofollow" aria-label="Share on X" title="X"><Twitter className="h-4 w-4" /></a>
        <button type="button" onClick={shareNatively} className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Share using your device" title="Share"><Share2 className="h-4 w-4" /></button>
        <button type="button" onClick={copyLink} className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Copy eBook link"><Copy className="h-4 w-4" />{copied ? <><Check className="h-4 w-4" /><span aria-live="polite">Copied</span></> : "Copy link"}</button>
      </div>
      {error ? <p role="alert" className="mt-2 text-sm text-destructive">{error}</p> : null}
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
