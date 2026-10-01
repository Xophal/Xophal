import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, FileText, Languages } from "lucide-react";

export type EbookCardData = {
  id: string;
  title: string;
  slug: string;
  cover_image_url: string;
  short_description: string;
  author_name: string;
  language: string;
  page_count: number | null;
  price: number | string;
  currency: string;
  subject?: string | null;
  exam?: string | null;
  ebook_categories?: { name: string; slug: string } | { name: string; slug: string }[] | null;
  ebook_contributors?: { display_name?: string | null; slug: string } | { display_name?: string | null; slug: string }[] | null;
};

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export function formatEbookPrice(price: number | string, currency: string) {
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) return "Free";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: (currency || "INR").toUpperCase(),
    maximumFractionDigits: 2,
  }).format(amount);
}

export function EbookCard({ book }: { book: EbookCardData }) {
  const category = relation(book.ebook_categories);

  return (
    <article className="group grid min-w-0 grid-cols-[104px_minmax(0,1fr)] gap-4 border-b border-border py-5 sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-5">
      <Link
        href={`/ebooks/${book.slug}`}
        className="relative aspect-[3/4] overflow-hidden rounded-md bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`View ${book.title}`}
      >
        <Image
          src={book.cover_image_url}
          alt={`Cover of ${book.title}`}
          fill
          sizes="(max-width: 640px) 104px, 132px"
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      </Link>
      <div className="flex min-w-0 flex-col items-start py-0.5">
        {category ? (
          <Link href={`/ebooks/category/${category.slug}`} className="text-xs font-semibold uppercase text-primary hover:underline">
            {category.name}
          </Link>
        ) : null}
        <h2 className="mt-1 line-clamp-2 text-base font-bold leading-6 text-foreground sm:text-lg">
          <Link href={`/ebooks/${book.slug}`} className="hover:underline">
            {book.title}
          </Link>
        </h2>
        <p className="mt-1 truncate text-sm text-muted-foreground">By {book.author_name}</p>
        <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">{book.short_description}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-xs text-muted-foreground">
          {book.page_count ? (
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              {book.page_count} pages
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Languages className="h-3.5 w-3.5" aria-hidden="true" />
            {book.language}
          </span>
          {book.subject ? <span className="max-w-28 truncate">{book.subject}</span> : null}
        </div>
        <div className="mt-3 flex w-full items-center justify-between gap-3 border-t border-border/70 pt-3">
          <span className="text-sm font-bold tabular-nums text-foreground">{formatEbookPrice(book.price, book.currency)}</span>
          <Link
            href={`/ebooks/${book.slug}`}
            className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            View book <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default EbookCard;
