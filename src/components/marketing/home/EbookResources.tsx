import Link from "next/link";
import { ArrowUpRight, BookOpen, Store } from "lucide-react";
import { APP_NAME } from "@/constants";
import EbookCard from "@/components/ebooks/EbookCard";
import { listPublishedEbooks } from "@/lib/ebooks/data";

/**
 * Homepage marketplace teaser. Renders nothing until at least one listing is
 * published so the primary mock-test funnel is never padded with empty states.
 */
export default async function EbookResources() {
  const { books } = await listPublishedEbooks({ sort: "latest", limit: 3 });
  if (!books.length) return null;

  return (
    <section className="border-y border-border bg-muted/35">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase text-primary">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Study resources
            </p>
            <h2 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">Explore Study Resources</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Discover study materials, exam guides, notes and educational eBooks on {APP_NAME}, then put what you learn to work in a free mock test.
            </p>
          </div>
          <Link
            href="/ebooks"
            className="inline-flex min-h-11 w-fit items-center gap-1 rounded-md border border-border px-4 text-sm font-semibold hover:bg-background"
          >
            Explore All eBooks <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-6 grid gap-x-8 md:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <EbookCard key={book.id} book={book} />
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-border pt-6">
          <Link
            href="/dashboard/ebooks/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Store className="h-4 w-4" aria-hidden="true" />
            Publish your eBook
          </Link>
          <p className="text-xs text-muted-foreground">Free listings, admin-reviewed. You keep the majority of every sale.</p>
        </div>
      </div>
    </section>
  );
}