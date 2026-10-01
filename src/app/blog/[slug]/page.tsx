import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { APP_NAME } from "@/constants";
import BlogArticle from "@/components/blog/blog-article";
import { estimateReadingMinutes, renderBlogContent } from "@/lib/blog-content";
import { getBlogAuthorName, getPublishedBlogBySlug, getRelatedBlogs } from "@/lib/blog-data";

export const dynamic = "force-dynamic";

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
  return new Date(value || fallback).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBlogBySlug(slug);
  if (!post) return { title: `Article not found | ${APP_NAME}` };

  const title = post.meta_title || post.title;
  const description = post.meta_description || post.excerpt || undefined;
  const image = safeImageUrl(post.featured_image_url);
  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      publishedTime: post.published_at || post.created_at,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedBlogBySlug(slug);
  if (!post) notFound();

  const [related, contentHtml] = await Promise.all([
    getRelatedBlogs(post),
    renderBlogContent(post.content_html || post.content || ""),
  ]);
  const image = safeImageUrl(post.featured_image_url);
  const readingMinutes = estimateReadingMinutes(post.content || post.content_html || "");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 lg:px-8 lg:py-12">
      <BlogArticle className="space-y-8">
        <Link href="/blog" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-950">
          <ArrowLeft className="h-4 w-4" /> All articles
        </Link>

        <header className="grid gap-0 overflow-hidden rounded-md border border-slate-200 bg-white md:grid-cols-[1fr_0.9fr]">
          <div className="relative min-h-56 bg-emerald-50 md:min-h-[28rem]">
            {image ? <Image src={image} alt="" fill priority sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" /> : <div className="absolute inset-0 bg-[linear-gradient(135deg,#047857_0%,#0f766e_48%,#facc15_100%)]" />}
          </div>
          <div className="flex flex-col justify-center gap-5 p-6 md:p-9 lg:p-12">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500">
              {post.tags?.map((tag) => <Link key={tag} href={`/blog?tag=${encodeURIComponent(tag)}`} className="font-semibold text-emerald-800 hover:underline">{tag}</Link>)}
              <span>{readingMinutes} min read</span>
            </div>
            <h1 className="text-3xl font-bold leading-tight text-slate-950 md:text-4xl lg:text-5xl">{post.title}</h1>
            {post.excerpt && <p className="text-base leading-7 text-slate-600">{post.excerpt}</p>}
            <div className="border-t border-slate-200 pt-4 text-sm">
              <p className="font-semibold text-slate-800">{getBlogAuthorName(post)}</p>
              <time dateTime={post.published_at || post.created_at} className="mt-1 block text-slate-500">{dateLabel(post.published_at, post.created_at)}</time>
            </div>
          </div>
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px]">
          <article className="prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-emerald-800 prose-img:rounded-md prose-pre:overflow-x-auto">
            <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
          </article>
          <aside className="self-start border-t border-emerald-700 pt-4 lg:sticky lg:top-24">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">In this article</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">A {readingMinutes}-minute read from the Xophol learning journal.</p>
            <Link href="/blog" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-800 hover:text-emerald-800">
              Browse more articles <ArrowRight className="h-4 w-4" />
            </Link>
          </aside>
        </div>

        {related.length > 0 && (
          <section className="border-t border-slate-200 pt-6">
            <h2 className="text-xl font-bold text-slate-950">Keep reading</h2>
            <div className="mt-4 grid gap-x-6 md:grid-cols-3">
              {related.map((item) => (
                <article key={item.id} className="border-b border-slate-200 py-4">
                  <p className="text-xs text-slate-500">{item.tags?.[0] || "Learning"}</p>
                  <h3 className="mt-2 font-semibold leading-6 text-slate-900"><Link href={`/blog/${item.slug}`} className="hover:text-emerald-800">{item.title}</Link></h3>
                  <Link href={`/blog/${item.slug}`} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800">Read article <ArrowRight className="h-4 w-4" /></Link>
                </article>
              ))}
            </div>
          </section>
        )}
      </BlogArticle>
    </main>
  );
}
