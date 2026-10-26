import { cache } from "react";
import sanitizeHtml from "sanitize-html";
import { blogDemoPosts, type BlogDemoPost } from "@/data/blog-demo";
import { createAdminClient } from "@/lib/supabase/admin";

const coverTones = [
  "from-emerald-600 via-teal-500 to-yellow-400",
  "from-amber-500 via-orange-500 to-red-500",
  "from-violet-600 via-indigo-500 to-cyan-400",
  "from-sky-600 via-blue-500 to-indigo-400",
];

export function sanitizeBlogHtml(content: string) {
  return sanitizeHtml(content, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "h1",
      "h2",
      "h3",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height"],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
  });
}

type BlogRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  content_html: string | null;
  published_at: string | null;
  created_at: string;
  tags: string[] | null;
};

export const getPublicBlogPosts = cache(async (): Promise<BlogDemoPost[]> => {
  const { data, error } = await createAdminClient()
    .from("blogs")
    .select("id, slug, title, excerpt, content, content_html, published_at, created_at, tags")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  if (error) throw error;
  if (!data?.length) return blogDemoPosts;

  return (data as BlogRow[]).map((row, index) => {
    const content = row.content_html || row.content || "";
    const wordCount = content.replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length;

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt || "",
      category: row.tags?.[0] || "Xophol Blog",
      readTime: `${Math.max(1, Math.ceil(wordCount / 200))} min read`,
      author: "Xophol Editorial Desk",
      published_at: row.published_at || row.created_at,
      featured: index === 0,
      coverTone: coverTones[index % coverTones.length],
      contentHtml: sanitizeBlogHtml(content),
    };
  });
});

export const getPublicBlogPost = cache(async (slug: string) => {
  const posts = await getPublicBlogPosts();
  return posts.find((post) => post.slug === slug);
});
