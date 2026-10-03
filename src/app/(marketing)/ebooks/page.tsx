import Link from "next/link";
import type { Metadata } from "next";
import { APP_NAME } from "@/constants";
import EbookCard from "@/components/ebooks/EbookCard";
import EbookTelemetry from "@/components/ebooks/EbookTelemetry";
import { getEbookCategories, getPublishedEbookFacets, listPublishedEbooks, type EbookFilters } from "@/lib/ebooks/data";
import { getPublicSocialImage } from "@/lib/ebooks/seo";

type Props = { searchParams: Promise<{ q?: string; category?: string; subject?: string; exam?: string; language?: string; price?: string; min?: string; max?: string; sort?: string; page?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const isFiltered = Object.values(params).some((value) => Boolean(value?.trim()));
  const title = `Explore eBooks | ${APP_NAME}`;
  const description = `Discover study materials, exam guides, notes and educational eBooks from authors and educators on ${APP_NAME}, then continue exam preparation with free mock tests.`;
  const image = getPublicSocialImage();
  return {
    title,
    description,
    robots: isFiltered ? { index: false, follow: true } : undefined,
    alternates: { canonical: "/ebooks" },
    openGraph: { type: "website", siteName: APP_NAME, title, description, url: "/ebooks", images: [{ url: image, alt: "Study eBooks on Xophol" }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

function numericFilter(value?: string) {
  if (!value || !/^\d{1,7}(\.\d{1,2})?$/.test(value)) return undefined;
  return Number(value);
}

const PRICE_VALUES = new Set(["free", "paid", "under50", "50to99", "100to199", "200to399", "400plus"]);
const SORT_VALUES = new Set(["latest", "oldest", "price_low", "price_high", "az"]);

export default async function EbooksPage({ searchParams }: Props) {
  const params = await searchParams;
  const [categories, facets] = await Promise.all([getEbookCategories(), getPublishedEbookFacets()]);
  const price = PRICE_VALUES.has(params.price ?? "") ? (params.price as EbookFilters["price"]) : undefined;
  const sort = SORT_VALUES.has(params.sort ?? "") ? (params.sort as NonNullable<EbookFilters["sort"]>) : "latest";
  const filters: EbookFilters = {
    search: params.q,
    category: params.category,
    subject: params.subject,
    exam: params.exam,
    language: params.language,
    price,
    minPrice: numericFilter(params.min),
    maxPrice: numericFilter(params.max),
    sort,
    page: numericFilter(params.page),
    limit: 12,
  };
  const { books, total, page, limit } = await listPublishedEbooks(filters);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.category) query.set("category", params.category);
  if (params.subject) query.set("subject", params.subject);
  if (params.exam) query.set("exam", params.exam);
  if (params.language) query.set("language", params.language);
  if (params.price) query.set("price", params.price);
  if (params.min) query.set("min", params.min);
  if (params.max) query.set("max", params.max);
  if (params.sort) query.set("sort", params.sort);

  return (
    <main className="min-h-screen bg-background">
      {params.q ? <EbookTelemetry eventName="ebook_search" searchTerm={params.q} source="catalog" /> : null}
      {params.category || params.subject || params.exam || params.language || params.price || params.min || params.max || (params.sort && params.sort !== "latest")
        ? <EbookTelemetry eventName="ebook_filter_used" source="catalog" searchTerm={[params.category && `category:${params.category}`, params.subject && `subject:${params.subject}`, params.exam && `exam:${params.exam}`, params.language && `language:${params.language}`, params.price && `price:${params.price}`, params.sort && `sort:${params.sort}`].filter(Boolean).join(" ").slice(0, 100)} />
        : null}
      <section className="border-b border-border bg-muted/35">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase text-primary">Study resources</p>
              <h1 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">Explore eBooks</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Discover study materials, exam guides, notes and educational eBooks from authors and educators.</p>
            </div>
            <Link href="/dashboard/ebooks/new" className="inline-flex min-h-11 w-fit items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Publish your eBook</Link>
          </div>
          <nav aria-label="eBook categories" className="mt-6 flex gap-2 overflow-x-auto pb-1">
            <Link href="/ebooks" className={`shrink-0 rounded-md border px-3 py-2 text-sm ${!params.category ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-background"}`}>All books</Link>
            {categories.map((category) => <Link key={category.id} href={`/ebooks/category/${category.slug}`} className={`shrink-0 rounded-md border px-3 py-2 text-sm ${params.category === category.slug ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-background"}`}>{category.name}</Link>)}
          </nav>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <form action="/ebooks" className="grid gap-3 rounded-md border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.5fr)_repeat(7,minmax(110px,1fr))_auto]">
          <label className="sr-only" htmlFor="ebook-q">Search eBooks</label>
          <input id="ebook-q" name="q" defaultValue={params.q} placeholder="Search eBooks, exams, subjects or authors..." className="h-11 min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" />
          <label className="sr-only" htmlFor="ebook-category">Category</label>
          <select id="ebook-category" name="category" defaultValue={params.category ?? ""} className="h-11 rounded-md border border-input bg-background px-3 text-sm"><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}</select>
          {facets.subjects.length ? <>
            <label className="sr-only" htmlFor="ebook-subject">Subject</label>
            <select id="ebook-subject" name="subject" defaultValue={params.subject ?? ""} className="h-11 rounded-md border border-input bg-background px-3 text-sm"><option value="">All subjects</option>{facets.subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select>
          </> : null}
          {facets.exams.length ? <>
            <label className="sr-only" htmlFor="ebook-exam">Exam</label>
            <select id="ebook-exam" name="exam" defaultValue={params.exam ?? ""} className="h-11 rounded-md border border-input bg-background px-3 text-sm"><option value="">All exams</option>{facets.exams.map((exam) => <option key={exam} value={exam}>{exam}</option>)}</select>
          </> : null}
          <label className="sr-only" htmlFor="ebook-language">Language</label>
          <select id="ebook-language" name="language" defaultValue={params.language ?? ""} className="h-11 rounded-md border border-input bg-background px-3 text-sm"><option value="">All languages</option>{facets.languages.map((language) => <option key={language} value={language}>{language}</option>)}</select>
          <label className="sr-only" htmlFor="ebook-price">Price</label>
          <select id="ebook-price" name="price" defaultValue={params.price ?? ""} className="h-11 rounded-md border border-input bg-background px-3 text-sm"><option value="">Any price</option><option value="free">Free</option><option value="under50">Under ₹50</option><option value="50to99">₹50–₹99</option><option value="100to199">₹100–₹199</option><option value="200to399">₹200–₹399</option><option value="400plus">₹400+</option></select>
          <label className="sr-only" htmlFor="ebook-min">Minimum price</label>
          <input id="ebook-min" name="min" type="number" min="0" step="1" defaultValue={params.min} placeholder="Min ₹" className="h-11 min-w-0 rounded-md border border-input bg-background px-3 text-sm" />
          <label className="sr-only" htmlFor="ebook-max">Maximum price</label>
          <input id="ebook-max" name="max" type="number" min="0" step="1" defaultValue={params.max} placeholder="Max ₹" className="h-11 min-w-0 rounded-md border border-input bg-background px-3 text-sm" />
          <label className="sr-only" htmlFor="ebook-sort">Sort books</label>
          <select id="ebook-sort" name="sort" defaultValue={sort} className="h-11 rounded-md border border-input bg-background px-3 text-sm"><option value="latest">Latest</option><option value="oldest">Oldest</option><option value="price_low">Price: low to high</option><option value="price_high">Price: high to low</option><option value="az">A–Z</option></select>
          <button type="submit" className="min-h-11 rounded-md bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90">Search</button>
        </form>

        <div className="mt-7 flex items-center justify-between gap-3 border-b border-border pb-3">
          <h2 className="text-sm font-semibold text-foreground">{total} {total === 1 ? "book" : "books"}</h2>
          <div className="flex items-center gap-3">
            {params.q || params.category || params.subject || params.exam || params.language || params.price || params.min || params.max ? <Link href="/ebooks" className="text-sm font-semibold text-primary hover:underline">Clear all filters</Link> : null}
            <Link href="/mock-tests" className="text-sm font-semibold text-primary hover:underline">Browse mock tests</Link>
          </div>
        </div>

        {books.length ? <div className="grid gap-x-8 md:grid-cols-2">{books.map((book) => <EbookCard key={book.id} book={book} />)}</div> : <div className="py-16 text-center"><h2 className="text-lg font-semibold text-foreground">No eBooks found</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Can&apos;t find the book you&apos;re looking for? Try another search, clear the filters, browse categories — or try Xophol mock tests instead.</p><div className="mt-5 flex flex-wrap items-center justify-center gap-3"><Link href="/ebooks" className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-semibold hover:bg-muted">Clear filters</Link><Link href="/mock-tests" className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">Explore mock tests</Link></div>{categories.length ? <nav aria-label="Browse categories" className="mt-6 flex flex-wrap justify-center gap-2">{categories.slice(0, 6).map((category) => <Link key={category.id} href={`/ebooks/category/${category.slug}`} className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground">{category.name}</Link>)}</nav> : null}</div>}

        {totalPages > 1 ? <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
          {page > 1 ? <Link href={`/ebooks?${new URLSearchParams([...query, ["page", String(page - 1)]]).toString()}`} className="inline-flex min-h-10 items-center rounded-md border border-border px-4 text-sm">Previous</Link> : null}
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          {page < totalPages ? <Link href={`/ebooks?${new URLSearchParams([...query, ["page", String(page + 1)]]).toString()}`} className="inline-flex min-h-10 items-center rounded-md border border-border px-4 text-sm">Next</Link> : null}
        </nav> : null}
      </section>
    </main>
  );
}
