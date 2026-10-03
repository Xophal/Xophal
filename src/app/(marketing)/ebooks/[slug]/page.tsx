import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, BookOpenCheck, FileText, Languages, Target } from "lucide-react";
import { EbookReport, EbookShare } from "@/components/ebooks/EbookActions";
import EbookPurchase from "@/components/ebooks/EbookPurchase";
import EbookTelemetry from "@/components/ebooks/EbookTelemetry";
import EbookCard from "@/components/ebooks/EbookCard";
import LearningDiscoveryTracker from "@/components/ebooks/LearningDiscoveryTracker";
import { getPublishedEbookBySlug, getRelatedEbooksForEbook, getRecommendedMockTestsForEbook } from "@/lib/ebooks/data";
import { hasVerifiedEbookPurchase } from "@/lib/ebooks/orders";
import { requireAuth } from "@/lib/auth";
import { getAppUrl, getEbookMetadata, getImageSource, getPublicImageUrl, getSubjectPagePath } from "@/lib/ebooks/seo";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sourceMockTestId?: string }>;
};

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function loadBook(slug: string) {
  return getPublishedEbookBySlug(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const book = await loadBook(slug);
  if (!book) return { title: "eBook not found", robots: { index: false, follow: false } };
  const category = relation(book.ebook_categories);
  return getEbookMetadata({
    title: book.title,
    slug: book.slug,
    authorName: book.author_name,
    description: book.short_description,
    exam: book.exam,
    subject: book.subject,
    language: book.language,
    coverImageUrl: book.cover_image_url,
    category: category?.name,
  });
}

export default async function EbookDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { sourceMockTestId } = await searchParams;
  const book = await loadBook(slug);
  if (!book) notFound();
  const categoryRelation = relation(book.ebook_categories);
  const category = categoryRelation?.is_active ? categoryRelation : null;
  const contributor = relation(book.ebook_contributors);
  const exam = relation(book.exams);
  const subject = relation(book.subjects);
  const examSlug = exam?.is_active ? exam.slug : null;
  const subjectClass = subject && relation(subject.classes);
  const subjectBoard = subjectClass && relation(subjectClass.boards);
  const subjectHref = subject?.is_active && subjectClass?.is_active && subjectBoard?.is_active
    ? getSubjectPagePath(subjectBoard.slug, subjectClass.slug, subject.slug)
    : null;
  const tests = await getRecommendedMockTestsForEbook(book);
  const session = await requireAuth();
  const owned = session ? await hasVerifiedEbookPurchase(session.user.id, book.id) : false;
  const relatedEbooks = await getRelatedEbooksForEbook({
    id: book.id,
    categoryId: book.category_id,
    subjectId: book.subject_id,
    examId: book.exam_id,
  });
  const offer = book.price === 0 ? "Free" : new Intl.NumberFormat("en-IN", { style: "currency", currency: book.currency || "INR", maximumFractionDigits: 0 }).format(Number(book.price));
  const canonicalUrl = getAppUrl(`/ebooks/${encodeURIComponent(book.slug)}`);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    author: { "@type": "Person", name: book.author_name },
    description: book.short_description,
    image: getPublicImageUrl(book.cover_image_url) ?? undefined,
    inLanguage: book.language,
    numberOfPages: book.page_count || undefined,
    datePublished: book.publication_date || undefined,
    url: canonicalUrl,
  };
  const breadcrumbItems = [
    { name: "Home", url: getAppUrl("/") },
    { name: "eBooks", url: getAppUrl("/ebooks") },
    ...(category ? [{ name: category.name, url: getAppUrl(`/ebooks/category/${category.slug}`) }] : []),
    ...(book.exam && examSlug ? [{ name: book.exam, url: getAppUrl(`/ebooks/exam/${examSlug}`) }] : []),
    ...(book.subject && subjectHref ? [{ name: book.subject, url: getAppUrl(subjectHref) }] : []),
    { name: book.title, url: canonicalUrl },
  ];
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <main className="min-h-screen bg-background">
      <EbookTelemetry eventName="ebook_page_view" ebookId={book.id} source="detail" />
      <LearningDiscoveryTracker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData).replace(/</g, "\\u003c") }} />
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground hover:underline">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/ebooks" className="hover:text-foreground hover:underline">eBooks</Link>
          {category ? <><span aria-hidden="true">/</span><Link href={`/ebooks/category/${category.slug}`} className="hover:text-foreground hover:underline">{category.name}</Link></> : null}
          {book.exam && examSlug ? <><span aria-hidden="true">/</span><Link href={`/ebooks/exam/${encodeURIComponent(examSlug)}`} className="hover:text-foreground hover:underline">{book.exam}</Link></> : null}
          {book.subject && subjectHref ? <><span aria-hidden="true">/</span><Link href={subjectHref} className="hover:text-foreground hover:underline">{book.subject}</Link></> : null}
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="max-w-full truncate text-foreground">{book.title}</span>
        </nav>
        <div className="mt-5 grid items-start gap-7 lg:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.4fr)] lg:gap-12">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-md border border-border bg-muted lg:mx-0">
            <Image
              src={getImageSource(book.cover_image_url)}
              alt={getPublicImageUrl(book.cover_image_url) ? `Cover of ${book.title}` : `Xophol study resource image for ${book.title}`}
              fill
              priority
              sizes="(max-width: 1024px) 80vw, 32vw"
              className="object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-primary">
              {category ? <Link href={`/ebooks/category/${category.slug}`} className="hover:underline">{category.name}</Link> : null}
              {book.exam ? (
                <>
                  <span aria-hidden="true">/</span>
                  {examSlug ? (
                    <Link href={`/ebooks/exam/${encodeURIComponent(examSlug)}`} className="text-muted-foreground hover:underline">
                      {book.exam}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">{book.exam}</span>
                  )}
                </>
              ) : null}
            </div>
            <h1 className="mt-2 text-3xl font-bold leading-tight text-foreground sm:text-4xl">{book.title}</h1>
            <p className="mt-2 text-base text-muted-foreground">By {book.author_name}</p>
            {contributor ? <Link href={`/authors/${contributor.slug}`} className="mt-2 inline-flex text-sm font-semibold text-primary hover:underline">View educator profile <ArrowUpRight className="ml-1 h-4 w-4" /></Link> : null}
            <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground">{book.short_description}</p>
            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {book.page_count ? <div className="border-l-2 border-primary/35 pl-3"><dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><FileText className="h-3.5 w-3.5" />Pages</dt><dd className="mt-1 font-semibold text-foreground">{book.page_count}</dd></div> : null}
              <div className="border-l-2 border-primary/35 pl-3"><dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Languages className="h-3.5 w-3.5" />Language</dt><dd className="mt-1 font-semibold text-foreground">{book.language}</dd></div>
              {book.subject ? <div className="border-l-2 border-primary/35 pl-3"><dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><BookOpenCheck className="h-3.5 w-3.5" />Subject</dt><dd className="mt-1 font-semibold text-foreground">{subjectHref ? <Link href={subjectHref} className="hover:underline">{book.subject}</Link> : book.subject}</dd></div> : null}
              <div className="border-l-2 border-primary/35 pl-3"><dt className="text-xs text-muted-foreground">Listed price</dt><dd className="mt-1 font-semibold text-foreground">{offer}</dd></div>
            </dl>

            <div className="mt-6 max-w-md border-y border-border py-4">
              <EbookPurchase
                ebookId={book.id}
                price={book.price}
                owned={owned}
                sourceMockTestId={sourceMockTestId}
              />
              {book.preview_url ? <a href={book.preview_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold hover:bg-muted">Preview</a> : null}
              <p className="mt-3 text-xs text-muted-foreground">The original book file lives on the author&apos;s own destination and opens here only after access is granted. Xophol never stores the book itself.</p>
            </div>

            <div className="mt-5"><EbookShare ebookId={book.id} title={book.title} description={book.short_description} canonicalUrl={canonicalUrl} /></div>
            <div className="mt-6 border-t border-border pt-5"><h2 className="text-lg font-semibold text-foreground">About this book</h2><div className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-7 text-muted-foreground">{book.full_description}</div></div>
            {contributor ? <div className="mt-6 border-t border-border pt-5"><h2 className="text-lg font-semibold text-foreground">About the educator</h2>{contributor.bio ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{contributor.bio}</p> : null}<Link href={`/authors/${contributor.slug}`} className="mt-3 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary hover:underline">View all books by {contributor.display_name ?? book.author_name} <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link></div> : null}
            <div className="mt-6"><EbookReport ebookId={book.id} /></div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/35">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="inline-flex items-center gap-2 text-xs font-bold uppercase text-primary"><Target className="h-4 w-4" />Continue exam preparation</p><h2 className="mt-1 text-xl font-bold text-foreground">Practice with Xophol Mock Tests</h2><p className="mt-1 text-sm text-muted-foreground">Preparing for this exam? Test your knowledge with Xophol mock tests.</p></div>
            <Link href={`/mock-tests?search=${encodeURIComponent(book.subject || book.exam || book.title)}`} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary hover:underline">View all mock tests <ArrowUpRight className="h-4 w-4" /></Link>
          </div>
          {tests.length ? <div className="mt-4 divide-y divide-border border-y border-border">{tests.map((test) => {
            const subject = Array.isArray(test.subjects) ? test.subjects[0] : test.subjects;
            const exam = Array.isArray(test.exams) ? test.exams[0] : test.exams;
            return <article key={test.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h3 className="font-semibold text-foreground">{test.title}</h3><p className="mt-1 text-sm text-muted-foreground">{[exam?.name, subject?.name].filter(Boolean).join(" · ")}</p>{test.description ? <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{test.description}</p> : null}<p className="mt-1 text-xs text-muted-foreground">{test.total_questions} questions · {test.duration_minutes} minutes{test.is_premium ? " · Premium access may be required" : ""}</p></div><Link href={`/test/${test.slug}?sourceEbookId=${book.id}`} data-discovery-impression="ebook_mock_test_impression" data-discovery-click="mock_test_from_ebook" data-ebook-id={book.id} data-mock-test-id={test.id} data-discovery-source="ebook_recommendation" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-primary/40 px-4 text-sm font-semibold text-primary hover:bg-primary/5">Start Mock Test<ArrowUpRight className="h-4 w-4" /></Link></article>;
          })}</div> : <div className="mt-4 flex flex-col gap-3 border-y border-border py-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">No matching mock tests available yet.</p><Link href={`/mock-tests?search=${encodeURIComponent(book.subject || book.exam || book.title)}`} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">Explore all mock tests<ArrowUpRight className="h-4 w-4" /></Link></div>}
        </div>
      </section>

      {relatedEbooks.length ? <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><h2 className="text-xl font-bold text-foreground">Related eBooks</h2><div className="mt-3 grid gap-x-8 md:grid-cols-2">{relatedEbooks.map((item) => <EbookCard key={item.id} book={item} />)}</div></section> : null}
    </main>
  );
}
