"use client";

import { useState } from "react";
import { BookOpen, Lock, ShoppingBag } from "lucide-react";
import { formatEbookPrice } from "@/components/ebooks/EbookCard";
import ManualUpiPurchase from "@/components/payment/ManualUpiPurchase";

/**
 * Buy/open control for the eBook detail page.
 *
 * Paid books require staff verification of a manual UPI payment before the
 * server considers the purchase complete. The external fulfilment URL is only
 * handed back after verification (or for free listings), and is never embedded
 * in the page.
 */
export function EbookPurchase({
  ebookId,
  slug,
  price,
  currency,
  owned,
  signedIn,
}: {
  ebookId: string;
  slug: string;
  price: number | string;
  currency: string;
  owned: boolean;
  signedIn: boolean;
}) {
  const [accessUrl, setAccessUrl] = useState<string | null>(owned ? `/api/ebooks/${ebookId}/external` : null);
  const isFree = Number(price) <= 0;

  async function openBook() {
    window.location.href = accessUrl ?? `/api/ebooks/${ebookId}/external`;
  }

  return (
    <div className="space-y-3">
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
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            {formatEbookPrice(price, currency)}
          </div>
          <ManualUpiPurchase resourceType="ebook" resourceId={ebookId} buttonLabel={`Pay ${formatEbookPrice(price, currency)} with UPI QR`} />
        </div>
      ) : (
        <a
          href={`/login?redirect=${encodeURIComponent(`/ebooks/${slug}`)}`}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Lock className="h-4 w-4" aria-hidden="true" />
          Sign in to buy
        </a>
      )}
      {!accessUrl && !isFree ? (
        <p className="text-xs text-muted-foreground">
          Your purchase will be available after staff verifies your UPI transaction. Seller proceeds are recorded for manual settlement.
        </p>
      ) : null}
    </div>
  );
}

export default EbookPurchase;