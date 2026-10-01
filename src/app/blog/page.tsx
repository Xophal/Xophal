import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, BookOpen, Search } from "lucide-react";
import { estimateReadingMinutes } from "@/lib/blog-content";
import { getBlogAuthorName, listPublishedBlogs, listPublishedBlogTags } from "@/lib/blog-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Learning Journal | Xophol",
  description: "Study strategies, revision systems, and practical exam advice from Xophol.",
};

const pageSize = 9;

function safeImageUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function dateLabel(value: string | null, fallback: string) {
  return new Date(value || fallback).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function pageHref(page: number, search: string, tag: string) {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (tag) params.set("tag", tag);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/blog?${query}` : "/blog";
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = (params.q || "").trim().slice(0, 100);
  const tag = (params.tag || "").trim().slice(0, 60);
  const requestedPage = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);
  const [initialResults, tags] = await Promise.all([
    listPublishedBlogs({ page: requestedPage, pageSize, search, tag }),
    listPublishedBlogTags(),
  ]);
  const { total } = initialResults;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const { posts } = page === requestedPage
    ? initialResults
    : await listPublishedBlogs({ page, pageSize, search, tag });
  const featured = page === 1 && !search && !tag ? posts[0] : null;
  const remaining = featured ? posts.slice(1) : posts;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-6 lg:px-8 lg:py-14">
      <header className="grid gap-6 border-b border-slate-200 pb-8 md:grid-cols-[1fr_auto] md:items-end">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Xophol Journal</p>
          <h1 className="text-3xl font-bold text-slate-950 md:text-5xl">Ideas for your next breakthrough.</h1>
          <p className="max-w-2xl text-base leading-7 text-slate-600">
            Practical study systems, exam strategies, and clear explanations for students who want progress they can sustain.
          </p>
        </div>
        <form action="/blog" className="flex w-full gap-2 md:w-[22rem]">
          {tag && <input type="hidden" name="tag" value={tag} />}
          <label className="sr-only" htmlFor="blog-search">Search articles</label>
          <input
            id="blog-search"
            name="q"
            defaultValue={search}
            placeholder="Search articles"
            className="h-11 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
          />
          <button type="submit" aria-label="Search articles" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white transition hover:bg-emerald-800">
            <Search className="h-4 w-4" />
          </button>
        </form>
      </header>

      {(tags.length > 0 || tag) && (
        <nav aria-label="Article topics" className="flex flex-wrap items-center gap-2 py-5">
          <Link href={pageHref(1, search, "")} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${!tag ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 text-slate-600 hover:border-emerald-700 hover:text-emerald-800"}`}>
            All topics
          </Link>
          {tags.map((item) => (
            <Link key={item} href={pageHref(1, search, item)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${tag === item ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 text-slate-600 hover:border-emerald-700 hover:text-emerald-800"}`}>
              {item}
            </Link>
          ))}
        </nav>
      )}

      {featured && (
        <article className="grid overflow-hidden border-b border-slate-200 py-6 md:grid-cols-[1.1fr_0.9fr] md:gap-8 md:py-8">
          <Link href={`/blog/${featured.slug}`} className="relative block min-h-56 overflow-hidden rounded-md bg-emerald-50 md:min-h-[22rem]">
            {safeImageUrl(featured.featured_image_url) ? (
              <Image src={safeImageUrl(featured.featured_image_url)!} alt="" fill priority sizes="(max-width: 768px) 100vw, 55vw" className="object-cover transition duration-500 hover:scale-[1.02]" />
            ) : <div className="absolute inset-0 bg-[linear-gradient(135deg,#047857_0%,#0f766e_48%,#facc15_100%)]" />}
          </Link>
          <div className="flex flex-col justify-center gap-5 py-4 md:py-8">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium text-slate-500">
              {featured.tags?.[0] && <span className="text-emerald-800">{featured.tags[0]}</span>}
              <span>{dateLabel(featured.published_at, featured.created_at)}</span>
              <span>{estimateReadingMinutes(featured.content || featured.content_html || "")} min read</span>
            </div>
            <div className="space-y-3">
              <h2 className="max-w-2xl text-2xl font-bold leading-tight text-slate-950 md:text-4xl">{featured.title}</h2>
              <p className="max-w-2xl leading-7 text-slate-600">{featured.excerpt}</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4 text-sm">
              <span className="text-slate-500">By {getBlogAuthorName(featured)}</span>
              <Link href={`/blog/${featured.slug}`} className="inline-flex items-center gap-2 font-semibold text-emerald-800 hover:text-emerald-950">
                Read article <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </article>
      )}

      <section aria-label="Articles" className="grid gap-x-6 md:grid-cols-2 xl:grid-cols-3">
        {remaining.map((post) => (
          <article key={post.id} className="flex flex-col border-b border-slate-200 py-6">
            <Link href={`/blog/${post.slug}`} className="relative mb-4 block aspect-[16/9] overflow-hidden rounded-md bg-slate-100">
              {safeImageUrl(post.featured_image_url) ? (
                <Image src={safeImageUrl(post.featured_image_url)!} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition duration-500 hover:scale-[1.03]" />
              ) : <div className="absolute inset-0 bg-[linear-gradient(135deg,#d1fae5_0%,#a7f3d0_48%,#fef3c7_100%)]" />}
            </Link>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
              {post.tags?.[0] && <span className="font-semibold text-emerald-800">{post.tags[0]}</span>}
              <span>{dateLabel(post.published_at, post.created_at)}</span>
              <span>{estimateReadingMinutes(post.content || post.content_html || "")} min read</span>
            </div>
            <h2 className="mt-3 text-xl font-bold leading-snug text-slate-950">
              <Link href={`/blog/${post.slug}`} className="hover:text-emerald-800">{post.title}</Link>
            </h2>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{post.excerpt}</p>
            <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-sm">
              <span className="truncate text-slate-500">{getBlogAuthorName(post)}</span>
              <Link href={`/blog/${post.slug}`} aria-label={`Read ${post.title}`} className="inline-flex shrink-0 items-center gap-1 font-semibold text-emerald-800 hover:text-emerald-950">
                Read <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        ))}
      </section>

      {posts.length === 0 && (
        <div className="grid min-h-64 place-items-center py-16 text-center">
          <div className="max-w-md">
            <BookOpen className="mx-auto h-8 w-8 text-emerald-700" />
            <h2 className="mt-4 text-xl font-semibold text-slate-950">No articles found</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Try a different search, or clear the topic filter to browse all published articles.</p>
            <Link href="/blog" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">Clear filters <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Article pages" className="flex items-center justify-between border-t border-slate-200 py-5">
          {page > 1 ? (
            <Link href={pageHref(page - 1, search, tag)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-emerald-800"><ArrowLeft className="h-4 w-4" /> Previous</Link>
          ) : <span />}
          <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1, search, tag)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-emerald-800">Next <ArrowRight className="h-4 w-4" /></Link>
          ) : <span />}
        </nav>
      )}
    </main>
  );
}
