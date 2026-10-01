"use client";

import Script from "next/script";
import { useState } from "react";
import { BookOpen, Lock, ShoppingBag } from "lucide-react";
import { formatEbookPrice } from "@/components/ebooks/EbookCard";

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  modal: { ondismiss: () => void };
};
type RazorpayInstance = { open: () => void };
type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

/**
 * Buy/open control for the eBook detail page.
 *
 * Paid books go through the server-created Razorpay order and server-side
 * verification; the browser never decides that a purchase happened. The
 * external fulfilment URL is only handed back after verification (or for free
 * listings), and is never embedded in the page.
 */
export function EbookPurchase({
  ebookId,
  slug,
  title,
  price,
  currency,
  owned,
  signedIn,
}: {
  ebookId: string;
  slug: string;
  title: string;
  price: number | string;
  currency: string;
  owned: boolean;
  signedIn: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [accessUrl, setAccessUrl] = useState<string | null>(owned ? `/api/ebooks/${ebookId}/external` : null);
  const isFree = Number(price) <= 0;

  async function openBook() {
    window.location.href = accessUrl ?? `/api/ebooks/${ebookId}/external`;
  }

  async function startCheckout() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/ebooks/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ebookId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) {
          setMessage(null);
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
        throw new Error(result.error || "Unable to start checkout.");
      }

      if (!window.Razorpay) throw new Error("Payment checkout is still loading. Please try again.");

      const checkout = new window.Razorpay({
        key: result.data.keyId,
        amount: result.data.providerOrder.amount,
        currency: result.data.providerOrder.currency,
        name: "Xophol",
        description: title.slice(0, 100),
        order_id: result.data.providerOrder.id,
        handler: async (paymentResponse) => {
          const verifyResponse = await fetch("/api/ebooks/purchase/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ebookId, ...paymentResponse }),
          });
          const verifyResult = await verifyResponse.json().catch(() => ({}));
          if (!verifyResponse.ok || !verifyResult.success || !verifyResult.data?.success) {
            throw new Error(verifyResult.error || "Payment could not be verified.");
          }
          setAccessUrl(verifyResult.data.accessUrl ?? `/api/ebooks/${ebookId}/external`);
          setMessage("Payment verified. Your book is ready.");
          setLoading(false);
        },
        modal: { ondismiss: () => setLoading(false) },
      });
      checkout.open();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      {accessUrl ? (
        <button
          type="button"
          onClick={openBook}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          {owned ? "Open your book" : "Read this book"}
        </button>
      ) : isFree ? (
        <button
          type="button"
          onClick={openBook}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          Read this book
        </button>
      ) : signedIn ? (
        <button
          type="button"
          onClick={startCheckout}
          disabled={loading}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
        >
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
          {loading ? "Processing…" : `Buy now for ${formatEbookPrice(price, currency)}`}
        </button>
      ) : (
        <a
          href={`/login?redirect=${encodeURIComponent(`/ebooks/${slug}`)}`}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Lock className="h-4 w-4" aria-hidden="true" />
          Sign in to buy
        </a>
      )}
      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
      {!accessUrl && !isFree ? (
        <p className="text-xs text-muted-foreground">
          Secure checkout by Razorpay. Your book opens here after payment is verified.
        </p>
      ) : null}
    </div>
  );
}

export default EbookPurchase;