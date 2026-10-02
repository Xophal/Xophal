import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpenCheck, Target } from "lucide-react";
import { APP_URL } from "@/constants";
import EbookCard, { type EbookCardData } from "@/components/ebooks/EbookCard";
import EbookTelemetry from "@/components/ebooks/EbookTelemetry";
import { getPublicContributor } from "@/lib/ebooks/data";

type Props = { params: Promise<{ slug: string }> };

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const contributor = await getPublicContributor(slug);
  if (!contributor) return { title: "Educator not found | Xophol", robots: { index: false, follow: false } };
  const description = contributor.bio?.slice(0, 160) || `Browse educational eBooks published by ${contributor.display_name} on Xophol.`;
  const url = `${APP_URL}/authors/${contributor.slug}`;
  return {
    title: `${contributor.display_name} — educator eBooks | Xophol`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      url,
      title: `${contributor.display_name} | Xophol`,
      description,
      images: contributor.profile_image_url ? [{ url: contributor.profile_image_url, alt: contributor.display_name }] : undefined,
    },
  };
}

export default async function AuthorProfilePage({ params }: Props) {
  const { slug } = await params;
  const contributor = await getPublicContributor(slug);
  if (!contributor) notFound();

  const books = (contributor.ebook_listings ?? []) as EbookCardData[];
  const expertise = ((contributor.expertise ?? []) as unknown[])
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, 12);
  const links = socialLinks(contributor.social_links);
  if (contributor.website_url && !links.some((link) => link.href === contributor.website_url)) {
    links.unshift({ label: "Website", href: contributor.website_url });
  }
  const canonical = `${APP_URL}/authors/${contributor.slug}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: contributor.display_name,
    description: contributor.bio || undefined,
    image: contributor.profile_image_url || undefined,
    url: canonical,
    knowsAbout: expertise.length ? expertise : undefined,
    sameAs: links.length ? links.map((link) => link.href) : undefined,
  };

  return (
    <main className="min-h-screen bg-background">
      <EbookTelemetry eventName="author_profile_view" source="author_page" />
      <EbookTelemetry eventName="seller_profile_view" source="author_page" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />

      <section className="border-b border-border bg-muted/35">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <p className="text-xs font-bold uppercase text-primary">
            <Link href="/ebooks" className="hover:underline">
              eBooks
            </Link>{" "}
            / Educator
          </p>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-background">
                {contributor.profile_image_url ? (
                  <Image src={contributor.profile_image_url} alt={contributor.display_name} fill sizes="80px" className="object-cover" />
                ) : (
                  <span aria-hidden="true" className="flex h-full w-full items-center justify-center text-xl font-bold text-primary">
                    {initials(contributor.display_name)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{contributor.display_name}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {books.length} published {books.length === 1 ? "eBook" : "eBooks"} on Xophol
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
        ) : (
          <div className="py-14 text-center">
            <h3 className="text-lg font-semibold text-foreground">No published eBooks yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">This educator has no public listing right now.</p>
            <Link href="/ebooks" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
              Browse the store
            </Link>
          </div>
        )}
      </section>

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
