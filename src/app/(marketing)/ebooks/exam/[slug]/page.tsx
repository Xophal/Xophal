import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, GraduationCap, Target } from "lucide-react";
import { APP_NAME } from "@/constants";
import EbookCard, { type EbookCardData } from "@/components/ebooks/EbookCard";
import EbookTelemetry from "@/components/ebooks/EbookTelemetry";
import { getExamLandingData } from "@/lib/ebooks/data";
import { getAppUrl, getPublicSocialImage, getSeoDescription, getSubjectPagePath, getSeoTitle } from "@/lib/ebooks/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const landing = await getExamLandingData(slug);
  if (!landing) return { title: "Exam eBooks not found", robots: { index: false, follow: false } };
  const { exam } = landing;
  const title = getSeoTitle(`${exam.name} eBooks`);
  const description = getSeoDescription(
    exam.description,
    `Study resources for ${exam.name} preparation — explore published eBooks on ${APP_NAME}.`,
  );
  const url = getAppUrl(`/ebooks/exam/${encodeURIComponent(exam.slug)}`);
  const image = getPublicSocialImage();
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: APP_NAME, title, description, url, images: [{ url: image, alt: `${exam.name} eBooks on ${APP_NAME}` }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function ExamEbookLandingPage({ params }: Props) {
  const { slug } = await params;
  const landing = await getExamLandingData(slug);
  if (!landing) notFound();
  const { exam, books, subjects, categorySlugs, relatedTests, relatedExams } = landing;
  const canonical = getAppUrl(`/ebooks/exam/${encodeURIComponent(exam.slug)}`);
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: getAppUrl("/") },
      { "@type": "ListItem", position: 2, name: "eBooks", item: getAppUrl("/ebooks") },
      { "@type": "ListItem", position: 3, name: `${exam.name} eBooks`, item: canonical },
    ],
  };

  return (
    <main className="min-h-screen bg-background">
      <EbookTelemetry eventName="ebook_category_view" source={`exam:${exam.slug}`} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData).replace(/</g, "\\u003c") }} />
      <section className="border-b border-border bg-muted/35">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground hover:underline">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href="/ebooks" className="hover:text-foreground hover:underline">eBooks</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page" className="text-foreground">{exam.name}</span>
          </nav>
          <p className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase text-primary">
            <GraduationCap className="h-4 w-4" aria-hidden="true" />
            Exam resources
          </p>
          <h1 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">{exam.name} eBooks</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Study resources for {exam.name} preparation.</p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <Link href={`/ebooks?exam=${encodeURIComponent(exam.name)}`} className="font-semibold text-primary hover:underline">Filter all {exam.name} books</Link>
            <Link href={`/mock-tests?search=${encodeURIComponent(exam.name)}`} className="font-semibold text-primary hover:underline">Browse {exam.name} mock tests</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <h2 className="text-sm font-semibold text-foreground">{books.length} {books.length === 1 ? "book" : "books"}</h2>
          <Link href="/ebooks" className="text-sm font-semibold text-primary hover:underline">All eBooks</Link>
        </div>
        <div className="mt-2 grid gap-x-8 md:grid-cols-2">{books.map((book) => <EbookCard key={book.id} book={book as EbookCardData} />)}</div>

        {subjects.length ? (
          <nav aria-label="Subjects for this exam" className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase text-muted-foreground">Subjects</span>
            {subjects.map((subject) => (
              <Link key={`${subject.boardSlug}/${subject.classSlug}/${subject.slug}`} href={getSubjectPagePath(subject.boardSlug, subject.classSlug, subject.slug)} className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-background hover:text-foreground">
                {subject.name}
              </Link>
            ))}
          </nav>
        ) : null}
        {categorySlugs.length ? (
          <nav aria-label="Categories for this exam" className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase text-muted-foreground">Categories</span>
            {categorySlugs.map((categorySlug) => (
              <Link key={categorySlug} href={`/ebooks/category/${encodeURIComponent(categorySlug)}`} className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-background hover:text-foreground">
                {categorySlug.replace(/-/g, " ")}
              </Link>
            ))}
          </nav>
        ) : null}
      </section>

      <section className="border-t border-border bg-muted/35">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase text-primary"><Target className="h-4 w-4" aria-hidden="true" />Continue exam preparation</p>
              <h2 className="mt-1 text-xl font-bold text-foreground">Practice with {APP_NAME} Mock Tests</h2>
              <p className="mt-1 text-sm text-muted-foreground">Preparing for {exam.name}? Test your knowledge with free mock tests.</p>
            </div>
            <Link href={`/mock-tests?search=${encodeURIComponent(exam.name)}`} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary hover:underline">View all mock tests <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
          {relatedTests.length ? (
            <div className="mt-4 divide-y divide-border border-y border-border">
              {relatedTests.map((test) => {
                const subject = relation(test.subjects);
                const testExam = relation(test.exams);
                return (
                  <article key={test.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground">{test.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{[testExam?.name, subject?.name].filter(Boolean).join(" · ")}</p>
                      {test.description ? <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{test.description}</p> : null}
                      <p className="mt-1 text-xs text-muted-foreground">{test.total_questions} questions · {test.duration_minutes} minutes{test.is_premium ? " · Premium access may be required" : ""}</p>
                    </div>
                    <Link href={`/test/${test.slug}`} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-primary/40 px-4 text-sm font-semibold text-primary hover:bg-primary/5">
                      Start Mock Test <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3 border-y border-border py-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">No matching mock tests available yet.</p>
              <Link href="/mock-tests" className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">Explore all mock tests</Link>
            </div>
          )}
        </div>
      </section>

      {relatedExams.length ? (
        <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <h2 className="border-b border-border pb-3 text-lg font-bold text-foreground">Related exams</h2>
          <nav aria-label="Related exams" className="mt-4 flex flex-wrap gap-2">
            {relatedExams.map((related) => (
              <Link key={related.slug} href={`/ebooks/exam/${encodeURIComponent(related.slug)}`} className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-background hover:text-foreground">
                {related.name}
              </Link>
            ))}
          </nav>
        </section>
      ) : null}
    </main>
  );
}