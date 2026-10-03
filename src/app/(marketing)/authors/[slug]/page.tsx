import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpenCheck, Target } from "lucide-react";
import { APP_NAME } from "@/constants";
import EbookCard from "@/components/ebooks/EbookCard";
import EbookTelemetry from "@/components/ebooks/EbookTelemetry";
import { getPublicContributor, getPublicContributorEbooks, getRelatedMockTestsForEbooks } from "@/lib/ebooks/data";
import { getAppUrl, getImageSource, getPublicImageUrl, getPublicSocialImage, getSeoDescription, getSeoTitle } from "@/lib/ebooks/seo";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

const SOCIAL_LABELS: Record<string, string> = {
  website: "Website",
  blog: "Website",
  twitter: "Twitter",
  x: "X",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
  telegram: "Telegram",
};

/** Only absolute HTTPS destinations are surfaced from the free-form JSONB column. */
function socialLinks(links: unknown) {
  if (!links || typeof links !== "object" || Array.isArray(links)) return [];
  return Object.entries(links as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].startsWith("https://"))
    .slice(0, 6)
    .map(([key, value]) => ({ label: SOCIAL_LABELS[key.toLowerCase().replace(/[^a-z]/g, "")] ?? key, href: value }));
}

function initials(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return letters || "X";
}

function getPageNumber(value?: string | string[]) {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function getAuthorUrl(slug: string, page: number) {
  const path = `/authors/${encodeURIComponent(slug)}`;
  return page > 1 ? `${path}?page=${page}` : path;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { page: rawPage } = await searchParams;
  const page = getPageNumber(rawPage);
  const contributor = await getPublicContributor(slug);
  if (!contributor) return { title: "Educator not found", robots: { index: false, follow: false } };
  const title = getSeoTitle(`${contributor.display_name} — educator eBooks${page > 1 ? ` — Page ${page}` : ""}`);
  const description = getSeoDescription(contributor.bio, `Browse published educational eBooks by ${contributor.display_name} on Xophol.`);
  const url = getAppUrl(getAuthorUrl(contributor.slug, page));
  const pageCount = Math.ceil(contributor.publishedCount / 24);
  return {
    title,
    description,
    robots: page <= pageCount ? undefined : { index: false, follow: true },
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      siteName: APP_NAME,
      url,
      title,
      description,
      images: [{ url: getPublicSocialImage(contributor.profile_image_url), alt: contributor.display_name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [getPublicSocialImage(contributor.profile_image_url)],
    },
  };
}

export default async function AuthorProfilePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { page: rawPage } = await searchParams;
  const page = getPageNumber(rawPage);
  const contributor = await getPublicContributor(slug);
  if (!contributor) notFound();

  const { books, total, limit } = await getPublicContributorEbooks(slug, page);
  const pageCount = Math.ceil(total / limit);
  if (total === 0 || page > pageCount) notFound();
  const relatedTests = await getRelatedMockTestsForEbooks(books);
  const expertise = ((contributor.expertise ?? []) as unknown[])
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, 12);
  const links = socialLinks(contributor.social_links);
  if (contributor.website_url && !links.some((link) => link.href === contributor.website_url)) {
    links.unshift({ label: "Website", href: contributor.website_url });
  }
  const canonical = getAppUrl(`/authors/${encodeURIComponent(contributor.slug)}`);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: contributor.display_name,
    description: contributor.bio || undefined,
    image: getPublicImageUrl(contributor.profile_image_url) || undefined,
    url: canonical,
    knowsAbout: expertise.length ? expertise : undefined,
    sameAs: links.length ? links.map((link) => link.href) : undefined,
  };
  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: getAppUrl("/") },
      { "@type": "ListItem", position: 2, name: "eBooks", item: getAppUrl("/ebooks") },
      { "@type": "ListItem", position: 3, name: contributor.display_name, item: canonical },
    ],
  };

  return (
    <main className="min-h-screen bg-background">
      <EbookTelemetry eventName="author_profile_view" source="author_page" />
      <EbookTelemetry eventName="ebook_author_view" source="author_page" />
      <EbookTelemetry eventName="seller_profile_view" source="author_page" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData).replace(/</g, "\\u003c") }} />

      <section className="border-b border-border bg-muted/35">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground hover:underline">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href="/ebooks" className="hover:text-foreground hover:underline">eBooks</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page" className="text-foreground">{contributor.display_name}</span>
          </nav>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-background">
                {getPublicImageUrl(contributor.profile_image_url) ? (
                  <Image src={getImageSource(contributor.profile_image_url)} alt={contributor.display_name} fill sizes="80px" className="object-cover" />
                ) : (
                  <span aria-hidden="true" className="flex h-full w-full items-center justify-center text-xl font-bold text-primary">
                    {initials(contributor.display_name)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{contributor.display_name}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {contributor.publishedCount} published {contributor.publishedCount === 1 ? "eBook" : "eBooks"} on Xophol
                </p>
                {expertise.length ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {expertise.map((item) => (
                      <li key={item} className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
            {links.length ? (
              <ul className="flex flex-wrap gap-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex min-h-10 items-center rounded-md border border-border bg-background px-3 text-sm font-semibold hover:border-primary/40 hover:text-primary"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {contributor.bio ? <p className="mt-5 max-w-3xl whitespace-pre-line text-sm leading-7 text-muted-foreground">{contributor.bio}</p> : null}
          {contributor.qualification || contributor.teaching_experience || contributor.location ? (
            <dl className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
              {contributor.qualification ? <div><dt className="text-xs font-medium text-muted-foreground">Qualification</dt><dd className="mt-1 text-sm text-foreground">{contributor.qualification}</dd></div> : null}
              {contributor.teaching_experience ? <div><dt className="text-xs font-medium text-muted-foreground">Teaching experience</dt><dd className="mt-1 text-sm text-foreground">{contributor.teaching_experience}</dd></div> : null}
              {contributor.location ? <div><dt className="text-xs font-medium text-muted-foreground">Location</dt><dd className="mt-1 text-sm text-foreground">{contributor.location}</dd></div> : null}
            </dl>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-foreground">
            <BookOpenCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            Published eBooks
          </h2>
          <Link href="/ebooks" className="text-sm font-semibold text-primary hover:underline">
            All eBooks
          </Link>
        </div>
        {books.length ? (
          <div className="grid gap-x-8 md:grid-cols-2">
            {books.map((book) => (
              <EbookCard key={book.id} book={book} />
            ))}
          </div>
        ) : null}
        {pageCount > 1 ? (
          <nav aria-label="Educator eBook pages" className="mt-8 flex items-center justify-between gap-4 border-t border-border pt-4">
            {page > 1 ? (
              <Link rel="prev" href={getAuthorUrl(contributor.slug, page - 1)} className="inline-flex min-h-10 items-center rounded-md border border-border px-4 text-sm font-semibold hover:bg-muted">
                Previous page
              </Link>
            ) : <span />}
            <span className="text-sm text-muted-foreground">Page {page} of {pageCount}</span>
            {page < pageCount ? (
              <Link rel="next" href={getAuthorUrl(contributor.slug, page + 1)} className="inline-flex min-h-10 items-center rounded-md border border-border px-4 text-sm font-semibold hover:bg-muted">
                Next page
              </Link>
            ) : <span />}
          </nav>
        ) : null}
      </section>

      {relatedTests.length ? (
        <section className="border-t border-border bg-muted/35">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold text-foreground">Practice with related Xophol Mock Tests</h2>
            <div className="mt-4 divide-y divide-border border-y border-border">
              {relatedTests.map((test) => (
                <article key={test.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground">{test.title}</h3>
                    {test.description ? <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{test.description}</p> : null}
                  </div>
                  <Link href={`/test/${test.slug}`} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-primary/40 px-4 text-sm font-semibold text-primary hover:bg-primary/5">
                    Start Mock Test <Target className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-t border-border bg-muted/35">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-6 lg:px-8">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase text-primary">
              <Target className="h-4 w-4" aria-hidden="true" />
              Keep learning
            </p>
            <h2 className="mt-1 text-xl font-bold text-foreground">Practise what this educator teaches</h2>
            <p className="mt-1 text-sm text-muted-foreground">Free Xophol mock tests are always included with your account.</p>
          </div>
          <Link href="/mock-tests" className="inline-flex min-h-11 w-fit items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
            Browse mock tests
          </Link>
        </div>
      </section>
    </main>
  );
}
