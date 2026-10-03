import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, FileText, Languages } from "lucide-react";
import { getImageSource, getPublicImageUrl } from "@/lib/ebooks/seo";

export type EbookCardData = {
  id: string;
  title: string;
  slug: string;
  cover_image_url: string | null;
  short_description: string;
  author_name: string;
  language: string;
  page_count: number | null;
  price: number | string;
  currency: string;
  subject?: string | null;
  exam?: string | null;
  is_featured?: boolean | null;
  ebook_categories?: { name: string; slug: string; is_active?: boolean | null } | { name: string; slug: string; is_active?: boolean | null }[] | null;
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

export function EbookCard({ book, sourceMockTestId }: { book: EbookCardData; sourceMockTestId?: string }) {
  const category = relation(book.ebook_categories);
  const author = relation(book.ebook_contributors);
  const hasCover = Boolean(getPublicImageUrl(book.cover_image_url));
  const bookHref = sourceMockTestId
    ? `/ebooks/${book.slug}?sourceMockTestId=${encodeURIComponent(sourceMockTestId)}`
    : `/ebooks/${book.slug}`;

  return (
    <article className="group grid min-w-0 grid-cols-[104px_minmax(0,1fr)] gap-4 border-b border-border py-5 sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-5">
      <Link
        href={bookHref}
        className="relative aspect-[3/4] overflow-hidden rounded-md bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`View ${book.title}`}
        data-discovery-impression={sourceMockTestId ? "mock_test_ebook_impression" : undefined}
        data-discovery-click={sourceMockTestId ? "ebook_from_mock_test" : undefined}
        data-ebook-id={sourceMockTestId ? book.id : undefined}
        data-mock-test-id={sourceMockTestId}
        data-discovery-source={sourceMockTestId ? "mock_test_recommendation" : undefined}
      >
        <Image
          src={getImageSource(book.cover_image_url)}
          alt={hasCover ? `Cover of ${book.title}` : `Xophol study resource image for ${book.title}`}
          fill
          sizes="(max-width: 640px) 104px, 132px"
          loading="lazy"
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
        {book.is_featured ? (
          <span className="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
            Featured
          </span>
        ) : null}
      </Link>
      <div className="flex min-w-0 flex-col items-start py-0.5">
        {category && category.is_active !== false ? (
          <Link href={`/ebooks/category/${category.slug}`} className="text-xs font-semibold uppercase text-primary hover:underline">
            {category.name}
          </Link>
        ) : null}
        <h2 className="mt-1 line-clamp-2 text-base font-bold leading-6 text-foreground sm:text-lg">
          <Link href={bookHref} className="hover:underline">
            {book.title}
          </Link>
        </h2>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          By {author ? <Link href={`/authors/${author.slug}`} className="font-medium text-foreground/80 hover:text-primary hover:underline">{book.author_name}</Link> : book.author_name}
        </p>
        <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">{book.short_description}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-xs text-muted-foreground">
          {book.exam ? (
            <span className="max-w-28 truncate font-medium">{book.exam}</span>
          ) : null}
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
            href={bookHref}
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
