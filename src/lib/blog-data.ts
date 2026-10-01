import { createAdminClient } from "@/lib/supabase/admin";

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  content_html: string | null;
  featured_image_url: string | null;
  tags: string[] | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  meta_title: string | null;
  meta_description: string | null;
  profiles: { full_name: string | null } | null;
};

const postFields = "id, title, slug, excerpt, content, content_html, featured_image_url, tags, is_published, published_at, created_at, meta_title, meta_description, profiles(full_name)";

function cleanSearchTerm(value: string) {
  return value
    .trim()
    .slice(0, 100)
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function listPublishedBlogs({
  page = 1,
  pageSize = 9,
  search = "",
  tag = "",
}: {
  page?: number;
  pageSize?: number;
  search?: string;
  tag?: string;
} = {}) {
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(30, Math.max(1, Math.floor(pageSize)));
  const from = (safePage - 1) * safePageSize;
  let query = createAdminClient()
    .from("blogs")
    .select(postFields, { count: "exact" })
    .eq("is_published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const safeSearch = cleanSearchTerm(search);
  if (safeSearch) {
    query = query.or(`title.ilike.%${safeSearch}%,excerpt.ilike.%${safeSearch}%`);
  }

  const safeTag = cleanSearchTerm(tag);
  if (safeTag) query = query.contains("tags", [safeTag]);

  const { data, error, count } = await query.range(from, from + safePageSize - 1);
  if (error) throw error;

  return { posts: (data ?? []) as unknown as BlogPost[], total: count ?? 0 };
}

export async function listPublishedBlogTags() {
  const { data, error } = await createAdminClient()
    .from("blogs")
    .select("tags")
    .eq("is_published", true)
    .limit(500);

  if (error) throw error;
  return Array.from(new Set((data ?? []).flatMap((post) => post.tags ?? []))).sort((a, b) => a.localeCompare(b));
}

export async function getPublishedBlogBySlug(slug: string) {
  const { data, error } = await createAdminClient()
    .from("blogs")
    .select(postFields)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as BlogPost | null;
}

export async function getRelatedBlogs(post: BlogPost, limit = 3) {
  let query = createAdminClient()
    .from("blogs")
    .select(postFields)
    .eq("is_published", true)
    .neq("slug", post.slug)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  const firstTag = post.tags?.[0];
  if (firstTag) query = query.contains("tags", [firstTag]);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as BlogPost[];
}

export function getBlogAuthorName(post: BlogPost) {
  return post.profiles?.full_name?.trim() || "Xophol Editorial Desk";
}