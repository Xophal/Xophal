"use client";

import { Metadata } from "next";
import { motion } from "framer-motion";
import Link from "next/link";
import { APP_NAME } from "@/constants";
import { blogDemoPosts } from "@/data/blog-demo";

export default function BlogPage() {
  const posts = blogDemoPosts;

  const featuredPost = posts.find((post) => post.featured) ?? posts[0];

  return (
    <main className="container mx-auto max-w-6xl px-4 py-10 md:py-14">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <header className="rounded-[2rem] border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-6 shadow-[0_20px_45px_rgba(5,86,67,0.08)] md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Xophal Blog
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">Learning ideas for Assam Board students</h1>
            </div>
            <p className="max-w-xl text-sm leading-7 text-slate-600 md:text-base">
              Smart study routines, revision strategies, and classroom-friendly insights designed for SEBA and CBSE preparation.
            </p>
          </div>
        </header>

        {featuredPost && (
          <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
            <div className={`bg-gradient-to-br ${featuredPost.coverTone} h-52 md:h-64`} />
            <div className="grid gap-6 p-6 md:grid-cols-[1.4fr_0.8fr] md:p-8">
              <div className="space-y-4">
                <div className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                  {featuredPost.category}
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{featuredPost.title}</h2>
                  <p className="mt-3 text-base leading-7 text-slate-600">{featuredPost.excerpt}</p>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                  <span>{featuredPost.author}</span>
                  <span>•</span>
                  <span>{new Date(featuredPost.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                  <span>•</span>
                  <span>{featuredPost.readTime}</span>
                </div>
              </div>

              <div className="flex items-start justify-end">
                <Link
                  href={`/blog/${featuredPost.slug}`}
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Read article
                </Link>
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {posts.map((post) => (
            <article key={post.id} className="group overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
              <div className={`h-36 bg-gradient-to-br ${post.coverTone}`} />
              <div className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  <span>{post.category}</span>
                  <span>{post.readTime}</span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold leading-tight text-slate-900">{post.title}</h3>
                  <p className="text-sm leading-6 text-slate-600">{post.excerpt}</p>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-500">
                  <span>{post.author}</span>
                  <Link href={`/blog/${post.slug}`} className="font-semibold text-emerald-700 transition group-hover:text-emerald-800">
                    Read more →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      </motion.div>
    </main>
  );
}
