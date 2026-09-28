import { Metadata } from "next";
import { notFound } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Clock3, Sparkles } from "lucide-react";
import { APP_NAME } from "@/constants";
import { blogDemoPosts, getDemoPostBySlug } from "@/data/blog-demo";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = getDemoPostBySlug(params.slug);

  if (!post) {
    return { title: `Post | ${APP_NAME}` };
  }

  return {
    title: `${post.title} | ${APP_NAME}`,
    description: post.excerpt,
  };
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = getDemoPostBySlug(params.slug);

  if (!post) {
    return notFound();
  }

  const relatedPosts = blogDemoPosts.filter((item) => item.slug !== post.slug).slice(0, 2);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 md:px-6 lg:px-8 lg:py-14">
      <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="space-y-8">
        <header className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.08)]">
          <div className={`h-56 bg-gradient-to-br ${post.coverTone} md:h-80`} />

          <div className="space-y-6 p-6 md:p-8 lg:p-10">
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700 ring-1 ring-emerald-200">
                <Sparkles className="h-3.5 w-3.5" />
                {post.category}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 ring-1 ring-slate-200">
                <Clock3 className="h-3.5 w-3.5" />
                {post.readTime}
              </span>
            </div>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-3xl font-black tracking-tight text-slate-900 md:text-5xl lg:text-6xl">{post.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                <span className="font-medium text-slate-700">{post.author}</span>
                <span>•</span>
                <span>{new Date(post.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
            </div>

            <p className="max-w-3xl text-base leading-8 text-slate-600 md:text-lg">{post.excerpt}</p>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <article className="prose prose-slate max-w-none rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_45px_rgba(15,23,42,0.04)] md:p-8 lg:p-10">
            <div dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
          </article>

          <aside className="space-y-6">
            <div className="rounded-[1.7rem] border border-emerald-200 bg-emerald-50/80 p-5 shadow-[0_18px_40px_rgba(16,185,129,0.08)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Quick takeaway</p>
              <p className="mt-3 text-base leading-7 text-slate-700">
                The strongest routines are the ones you can maintain with calm consistency, not the ones that look intense on paper.
              </p>
            </div>

            <div className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-[0_18px_38px_rgba(15,23,42,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">More reading</p>
              <div className="mt-4 space-y-4">
                {relatedPosts.map((item) => (
                  <Link key={item.slug} href={`/blog/${item.slug}`} className="block rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50/60">
                    <div className={`mb-3 h-20 rounded-xl bg-gradient-to-br ${item.coverTone}`} />
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{item.category}</p>
                      <h2 className="text-base font-semibold leading-6 text-slate-900">{item.title}</h2>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-200 pt-6 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
          <Link href="/blog" className="inline-flex items-center gap-2 font-semibold text-emerald-700 transition hover:text-emerald-800">
            ← Back to the blog
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 font-semibold text-slate-700 transition hover:text-slate-900">
            Explore Xophol
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </motion.article>
    </main>
  );
}
