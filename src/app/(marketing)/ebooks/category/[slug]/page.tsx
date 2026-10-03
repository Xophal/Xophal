import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { APP_NAME } from "@/constants";
import EbookCard from "@/components/ebooks/EbookCard";
import EbookTelemetry from "@/components/ebooks/EbookTelemetry";
import { createClient } from "@/lib/supabase/server";
import { listPublishedEbooks } from "@/lib/ebooks/data";
import { getAppUrl, getPublicSocialImage, getSeoDescription, getSeoTitle } from "@/lib/ebooks/seo";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

const getCategory = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ebook_categories").select("id, name, slug, description").eq("slug", slug).eq("is_active", true).maybeSingle();
  if (error) throw error;
  return data;
});

const getCategoryCount = cache(async (categoryId: string) => {
  const supabase = await createClient();
  const { count, error } = await supabase.from("ebook_listings").select("id", { count: "exact", head: true }).eq("status", "PUBLISHED").eq("category_id", categoryId);
  if (error) throw error;
  return count ?? 0;
});

function getPageNumber(value?: string | string[]) {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function getCategoryUrl(slug: string, page: number) {
  const path = `/ebooks/category/${encodeURIComponent(slug)}`;
  return page > 1 ? `${path}?page=${page}` : path;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { page: rawPage } = await searchParams;
  const page = getPageNumber(rawPage);
  const category = await getCategory(slug);
  if (!category) return { title: "Study eBooks", robots: { index: false, follow: false } };
  const count = await getCategoryCount(category.id);
  const pageCount = Math.ceil(count / 24);
  const title = getSeoTitle(`${category.name} eBooks${page > 1 ? ` — Page ${page}` : ""}`);
  const description = getSeoDescription(category.description, `Explore published ${category.name.toLowerCase()} study books from educators on Xophol.`);
  return {
    title,
    description,
    robots: count > 0 && page <= pageCount ? undefined : { index: false, follow: true },
    alternates: { canonical: getAppUrl(getCategoryUrl(category.slug, page)) },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: APP_NAME,
      url: getAppUrl(getCategoryUrl(category.slug, page)),
      images: [{ url: getPublicSocialImage(), alt: `${category.name} eBooks on Xophol` }],
    },
    twitter: { card: "summary_large_image", title, description, images: [getPublicSocialImage()] },
  };
}

export default async function EbookCategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { page: rawPage } = await searchParams;
  const page = getPageNumber(rawPage);
  const category = await getCategory(slug);
  if (!category) notFound();
  const { books, total, limit } = await listPublishedEbooks({ category: slug, page, limit: 24 });
  const pageCount = Math.ceil(total / limit);
  if (total === 0 || page > pageCount) notFound();
  const canonical = getAppUrl(`/ebooks/category/${encodeURIComponent(category.slug)}`);
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: getAppUrl("/") },
      { "@type": "ListItem", position: 2, name: "eBooks", item: getAppUrl("/ebooks") },
      { "@type": "ListItem", position: 3, name: category.name, item: canonical },
    ],
  };
  return <main className="min-h-screen bg-background">
    <EbookTelemetry eventName="ebook_category_view" source={category.slug} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData).replace(/</g, "\\u003c") }} />
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <Link href="/" className="hover:text-foreground hover:underline">Home</Link><span aria-hidden="true">/</span>
      <Link href="/ebooks" className="hover:text-foreground hover:underline">eBooks</Link><span aria-hidden="true">/</span>
      <span aria-current="page" className="text-foreground">{category.name}</span>
    </nav>
    <h1 className="mt-2 text-3xl font-bold text-foreground">{category.name} eBooks</h1>
    {category.description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{category.description}</p> : null}
    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
      <Link href={`/ebooks?category=${encodeURIComponent(category.slug)}`} className="font-semibold text-primary hover:underline">Filter these books</Link>
      <Link href="/mock-tests" className="font-semibold text-primary hover:underline">Browse mock tests</Link>
    </div>
    <div className="mt-6 grid gap-x-8 md:grid-cols-2">{books.map((book) => <EbookCard key={book.id} book={book} />)}</div>
    {pageCount > 1 ? (
      <nav aria-label="eBook category pages" className="mt-8 flex items-center justify-between gap-4 border-t border-border pt-4">
        {page > 1 ? <Link rel="prev" href={getCategoryUrl(category.slug, page - 1)} className="inline-flex min-h-10 items-center rounded-md border border-border px-4 text-sm font-semibold hover:bg-muted">Previous page</Link> : <span />}
        <span className="text-sm text-muted-foreground">Page {page} of {pageCount}</span>
        {page < pageCount ? <Link rel="next" href={getCategoryUrl(category.slug, page + 1)} className="inline-flex min-h-10 items-center rounded-md border border-border px-4 text-sm font-semibold hover:bg-muted">Next page</Link> : <span />}
      </nav>
    ) : null}
  </section></main>;
}
