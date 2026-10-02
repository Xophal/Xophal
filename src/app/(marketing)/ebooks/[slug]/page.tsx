import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BookOpenCheck, FileText, Languages, Target } from "lucide-react";
import { APP_URL } from "@/constants";
import { EbookReport, EbookShare } from "@/components/ebooks/EbookActions";
import EbookPurchase from "@/components/ebooks/EbookPurchase";
import EbookTelemetry from "@/components/ebooks/EbookTelemetry";
import EbookCard from "@/components/ebooks/EbookCard";
import { getPublishedEbookBySlug, getRelatedFreeMockTests, listPublishedEbooks } from "@/lib/ebooks/data";
import { hasVerifiedEbookPurchase } from "@/lib/ebooks/orders";
import { requireAuth } from "@/lib/auth";

type Props = { params: Promise<{ slug: string }> };

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function loadBook(slug: string) {
  return getPublishedEbookBySlug(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const book = await loadBook(slug);
  if (!book) return { title: "eBook not found | Xophol", robots: { index: false, follow: false } };
  const description = book.short_description || `Explore ${book.title} by ${book.author_name} on Xophol.`;
  const url = `${APP_URL}/ebooks/${book.slug}`;
  return {
    title: `${book.title} by ${book.author_name} | Xophol`,
    description,
    alternates: { canonical: url },
    openGraph: { type: "book", url, title: `${book.title} | Xophol`, description, images: [{ url: book.cover_image_url, alt: `Cover of ${book.title}` }] },
    twitter: { card: "summary_large_image", title: `${book.title} | Xophol`, description, images: [book.cover_image_url] },
  };
}

export default async function EbookDetailPage({ params }: Props) {
  const { slug } = await params;
  const book = await loadBook(slug);
  if (!book) notFound();
  const category = relation(book.ebook_categories);
  const contributor = relation(book.ebook_contributors);
  const tests = await getRelatedFreeMockTests(book);
  const session = await requireAuth();
  const owned = session ? await hasVerifiedEbookPurchase(session.user.id, book.id) : false;
  const related = category ? await listPublishedEbooks({ category: category.slug, limit: 4 }) : { books: [] };
  const offer = book.price === 0 ? "Free" : new Intl.NumberFormat("en-IN", { style: "currency", currency: book.currency || "INR", maximumFractionDigits: 0 }).format(Number(book.price));
  const canonicalUrl = `${APP_URL}/ebooks/${book.slug}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    author: { "@type": "Person", name: book.author_name },
    description: book.short_description,
    image: book.cover_image_url,
    inLanguage: book.language,
    numberOfPages: book.page_count || undefined,
    datePublished: book.publication_date || undefined,
    url: canonicalUrl,
  };

  return (
    <main className="min-h-screen bg-background">
      <EbookTelemetry eventName="ebook_view" ebookId={book.id} source="detail" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/ebooks" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft className="h-4 w-4" />All eBooks</Link>
        <div className="mt-5 grid items-start gap-7 lg:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.4fr)] lg:gap-12">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-md border border-border bg-muted lg:mx-0">
            <Image src={book.cover_image_url} alt={`Cover of ${book.title}`} fill priority sizes="(max-width: 1024px) 80vw, 32vw" className="object-cover" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-primary">
              {category ? <Link href={`/ebooks/category/${category.slug}`} className="hover:underline">{category.name}</Link> : null}
              {book.exam ? <><span aria-hidden="true">/</span><span className="text-muted-foreground">{book.exam}</span></> : null}
            </div>
            <h1 className="mt-2 text-3xl font-bold leading-tight text-foreground sm:text-4xl">{book.title}</h1>
            <p className="mt-2 text-base text-muted-foreground">By {book.author_name}</p>
            {contributor ? <Link href={`/authors/${contributor.slug}`} className="mt-2 inline-flex text-sm font-semibold text-primary hover:underline">View educator profile <ArrowUpRight className="ml-1 h-4 w-4" /></Link> : null}
            <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground">{book.short_description}</p>
            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {book.page_count ? <div className="border-l-2 border-primary/35 pl-3"><dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><FileText className="h-3.5 w-3.5" />Pages</dt><dd className="mt-1 font-semibold text-foreground">{book.page_count}</dd></div> : null}
              <div className="border-l-2 border-primary/35 pl-3"><dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Languages className="h-3.5 w-3.5" />Language</dt><dd className="mt-1 font-semibold text-foreground">{book.language}</dd></div>
              {book.subject ? <div className="border-l-2 border-primary/35 pl-3"><dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><BookOpenCheck className="h-3.5 w-3.5" />Subject</dt><dd className="mt-1 font-semibold text-foreground">{book.subject}</dd></div> : null}
              <div className="border-l-2 border-primary/35 pl-3"><dt className="text-xs text-muted-foreground">Listed price</dt><dd className="mt-1 font-semibold text-foreground">{offer}</dd></div>
            </dl>

            <div className="mt-6 max-w-md border-y border-border py-4">
              <EbookPurchase
                ebookId={book.id}
                price={book.price}
                owned={owned}
              />
              {book.preview_url ? <a href={book.preview_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold hover:bg-muted">Preview</a> : null}
              <p className="mt-3 text-xs text-muted-foreground">The original book file lives on the author&apos;s own destination and opens here only after access is granted. Xophol never stores the book itself.</p>
            </div>

            <div className="mt-5"><EbookShare title={book.title} description={book.short_description} /></div>
            <div className="mt-6 border-t border-border pt-5"><h2 className="text-lg font-semibold text-foreground">About this book</h2><div className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-7 text-muted-foreground">{book.full_description}</div></div>
            {contributor ? <div className="mt-6 border-t border-border pt-5"><h2 className="text-lg font-semibold text-foreground">About the educator</h2>{contributor.bio ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{contributor.bio}</p> : null}<Link href={`/authors/${contributor.slug}`} className="mt-3 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary hover:underline">View all books by {contributor.display_name ?? book.author_name} <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link></div> : null}
            <div className="mt-6"><EbookReport ebookId={book.id} /></div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/35">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="inline-flex items-center gap-2 text-xs font-bold uppercase text-primary"><Target className="h-4 w-4" />Continue exam preparation</p><h2 className="mt-1 text-xl font-bold text-foreground">Test what you have learned</h2><p className="mt-1 text-sm text-muted-foreground">Free Xophol mock tests related to this subject or exam.</p></div>
            <Link href={`/mock-tests?search=${encodeURIComponent(book.subject || book.exam || book.title)}`} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary hover:underline">All mock tests <ArrowUpRight className="h-4 w-4" /></Link>
          </div>
          {tests.length ? <div className="mt-4 divide-y divide-border border-y border-border">{tests.map((test) => <article key={test.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h3 className="font-semibold text-foreground">{test.title}</h3>{test.description ? <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{test.description}</p> : null}<p className="mt-1 text-xs text-muted-foreground">{test.total_questions} questions · {test.duration_minutes} minutes · Free</p></div><Link href={`/test/${test.slug}`} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-primary/40 px-4 text-sm font-semibold text-primary hover:bg-primary/5">Start free mock test<ArrowUpRight className="h-4 w-4" /></Link></article>)}</div> : <div className="mt-4 flex flex-col gap-3 border-y border-border py-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">Browse available free tests and practice this topic.</p><Link href={`/mock-tests?search=${encodeURIComponent(book.subject || book.exam || book.title)}`} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">Find a free mock test<ArrowUpRight className="h-4 w-4" /></Link></div>}
        </div>
      </section>

      {related.books.filter((item) => item.slug !== book.slug).length ? <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><h2 className="text-xl font-bold text-foreground">More in {category?.name ?? "this subject"}</h2><div className="mt-3 grid gap-x-8 md:grid-cols-2">{related.books.filter((item) => item.slug !== book.slug).slice(0, 4).map((item) => <EbookCard key={item.id} book={item} />)}</div></section> : null}
    </main>
  );
}
