import { Metadata } from "next";
import { notFound } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { APP_NAME } from "@/constants";
import { getDemoPostBySlug } from "@/data/blog-demo";

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

  return (
    <main className="container mx-auto max-w-4xl px-4 py-10 md:py-14">
      <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <div className={`rounded-[2rem] bg-gradient-to-br ${post.coverTone} h-56 md:h-72`} />

        <div className="space-y-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)] md:p-8">
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 ring-1 ring-emerald-200">{post.category}</span>
            <span>{post.readTime}</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">{post.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span>{post.author}</span>
              <span>•</span>
              <span>{new Date(post.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
          </div>

          <p className="text-lg leading-8 text-slate-600">{post.excerpt}</p>
        </div>

        <article className="prose prose-slate max-w-none rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.04)] md:p-8">
          <div dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
        </article>

        <div className="flex items-center justify-between border-t border-slate-200 pt-6 text-sm text-slate-600">
          <Link href="/blog" className="inline-flex items-center gap-2 font-semibold text-emerald-700 transition hover:text-emerald-800">
            ← Back to blog
          </Link>
          <Link href="/" className="font-semibold text-slate-700 transition hover:text-slate-900">
            Explore Xophal
          </Link>
        </div>
      </motion.article>
    </main>
  );
}
