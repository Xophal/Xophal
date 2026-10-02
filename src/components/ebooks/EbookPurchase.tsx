"use client";

import { BookOpen } from "lucide-react";

/**
 * Buy/open control for the eBook detail page.
 *
 * Free listings and previously verified purchases can open their destination.
 * Paid listings remain unavailable until marketplace payments are enabled.
 */
export function EbookPurchase({
  ebookId,
  price,
  owned,
}: {
  ebookId: string;
  price: number | string;
  owned: boolean;
}) {
  const accessUrl = owned ? `/api/ebooks/${ebookId}/external` : null;
  const isFree = Number(price) <= 0;

  function openBook() {
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
      ) : (
        <div className="border-y border-border py-3" role="status">
          <p className="text-sm font-semibold text-foreground">Purchase option coming soon</p>
          <p className="mt-1 text-sm text-muted-foreground">Marketplace payments are not enabled yet.</p>
        </div>
      )}
    </div>
  );
}

export default EbookPurchase;