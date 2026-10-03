import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Target } from "lucide-react";
import { APP_NAME } from "@/constants";
import EbookCard from "@/components/ebooks/EbookCard";
import EbookTelemetry from "@/components/ebooks/EbookTelemetry";
import { getSubjectLandingData } from "@/lib/ebooks/data";
import { getAppUrl, getPublicSocialImage, getSeoDescription, getSeoTitle, getSubjectPagePath } from "@/lib/ebooks/seo";

type Props = {
  params: Promise<{ boardSlug: string; classSlug: string; slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

function getPageNumber(value?: string | string[]) {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function getSubjectUrl(boardSlug: string, classSlug: string, subjectSlug: string, page: number) {
  const path = getSubjectPagePath(boardSlug, classSlug, subjectSlug);
  return page > 1 ? `${path}?page=${page}` : path;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { boardSlug, classSlug, slug } = await params;
  const { page: rawPage } = await searchParams;
  const page = getPageNumber(rawPage);
  const landing = await getSubjectLandingData(boardSlug, classSlug, slug, page);
  if (!landing) return { title: "Subject eBooks not found", robots: { index: false, follow: false } };

  const { subject, classInfo, board } = landing;
  const title = getSeoTitle(`${subject.name} eBooks — ${classInfo.name}, ${board.name}${page > 1 ? ` — Page ${page}` : ""}`);
  const description = getSeoDescription(
    subject.description,
    `Explore published ${subject.name} study resources for ${classInfo.name}, ${board.name}, and related mock tests on ${APP_NAME}.`,
  );
  const url = getAppUrl(getSubjectUrl(board.slug, classInfo.slug, subject.slug, page));
  const image = getPublicSocialImage();
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: APP_NAME,
      title,
      description,
      url,
      images: [{ url: image, alt: `${subject.name} study resources on ${APP_NAME}` }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function SubjectEbookLandingPage({ params, searchParams }: Props) {
  const { boardSlug, classSlug, slug } = await params;
  const { page: rawPage } = await searchParams;
  const page = getPageNumber(rawPage);
  const landing = await getSubjectLandingData(boardSlug, classSlug, slug, page);
  if (!landing) notFound();

  const { subject, classInfo, board, books, relatedTests, total, pageSize } = landing;
  const pageCount = Math.ceil(total / pageSize);
  const canonical = getAppUrl(getSubjectPagePath(board.slug, classInfo.slug, subject.slug));
  const breadcrumbTitle = `${subject.name} · ${classInfo.name} · ${board.name}`;
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: getAppUrl("/") },
      { "@type": "ListItem", position: 2, name: "eBooks", item: getAppUrl("/ebooks") },
      { "@type": "ListItem", position: 3, name: breadcrumbTitle, item: canonical },
    ],
  };

  return (
    <main className="min-h-screen bg-background">
      <EbookTelemetry eventName="ebook_category_view" source={`subject:${subject.slug}`} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData).replace(/</g, "\\u003c") }}
      />
      <section className="border-b border-border bg-muted/35">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground hover:underline">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href="/ebooks" className="hover:text-foreground hover:underline">eBooks</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page" className="text-foreground">{breadcrumbTitle}</span>
          </nav>
          <p className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase text-primary">
            <Target className="h-4 w-4" aria-hidden="true" />
            Subject resources
          </p>
          <h1 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">{subject.name} eBooks</h1>
          <p className="mt-2 text-sm text-muted-foreground">{classInfo.name} · {board.name}</p>
          {subject.description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{subject.description}</p>
          ) : null}
          <Link
            href={`/mock-tests?search=${encodeURIComponent(subject.name)}`}
            className="mt-4 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            Browse {subject.name} mock tests <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <h2 className="text-sm font-semibold text-foreground">{total} {total === 1 ? "book" : "books"}</h2>
          <Link href="/ebooks" className="text-sm font-semibold text-primary hover:underline">All eBooks</Link>
        </div>
        <div className="mt-2 grid gap-x-8 md:grid-cols-2">
          {books.map((book) => <EbookCard key={book.id} book={book} />)}
        </div>
        {pageCount > 1 ? (
          <nav aria-label="eBook subject pages" className="mt-8 flex items-center justify-between gap-4 border-t border-border pt-4">
            {page > 1 ? (
              <Link rel="prev" href={getSubjectUrl(board.slug, classInfo.slug, subject.slug, page - 1)} className="inline-flex min-h-10 items-center rounded-md border border-border px-4 text-sm font-semibold hover:bg-muted">
                Previous page
              </Link>
            ) : <span />}
            <span className="text-sm text-muted-foreground">Page {page} of {pageCount}</span>
            {page < pageCount ? (
              <Link rel="next" href={getSubjectUrl(board.slug, classInfo.slug, subject.slug, page + 1)} className="inline-flex min-h-10 items-center rounded-md border border-border px-4 text-sm font-semibold hover:bg-muted">
                Next page
              </Link>
            ) : <span />}
          </nav>
        ) : null}
      </section>

      <section className="border-t border-border bg-muted/35">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-foreground">Practice with Xophol Mock Tests</h2>
          {relatedTests.length ? (
            <div className="mt-4 divide-y divide-border border-y border-border">
              {relatedTests.map((test) => {
                const testSubject = relation(test.subjects);
                const exam = relation(test.exams);
                return (
                  <article key={test.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground">{test.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {[exam?.name, testSubject?.name].filter(Boolean).join(" · ")}
                      </p>
                      {test.description ? <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{test.description}</p> : null}
                    </div>
                    <Link
                      href={`/test/${test.slug}`}
                      className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-primary/40 px-4 text-sm font-semibold text-primary hover:bg-primary/5"
                    >
                      Start Mock Test <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No matching mock tests are available yet. <Link href="/mock-tests" className="font-semibold text-primary hover:underline">Browse all mock tests</Link>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
