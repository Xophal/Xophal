import { createClient } from "@/lib/supabase/server";

export type EbookFilters = {
  search?: string;
  category?: string;
  author?: string;
  subject?: string;
  exam?: string;
  language?: string;
  price?: "free" | "paid";
  minPrice?: number;
  maxPrice?: number;
  sort?: "latest" | "popular" | "price_low" | "price_high";
  featured?: boolean;
  page?: number;
  limit?: number;
};

function cleanSearch(value: string) {
  return value.trim().replace(/[%,_()]/g, " ").slice(0, 100);
}

export async function getEbookCategories() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ebook_categories")
    .select("id, name, slug, description")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export async function listPublishedEbooks(filters: EbookFilters = {}) {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const limit = Math.min(24, Math.max(1, Math.floor(filters.limit ?? 12)));
  const offset = (page - 1) * limit;
  const supabase = await createClient();
  let query = supabase
    .from("ebook_listings")
    .select("id, title, slug, cover_image_url, short_description, subject, exam, language, page_count, price, currency, author_name, published_at, view_count, external_click_count, ebook_categories(name, slug), ebook_contributors(slug)", { count: "exact" })
    .eq("status", "PUBLISHED");

  const search = filters.search ? cleanSearch(filters.search) : "";
  if (search) {
    const { data: matchingCategories } = await supabase.from("ebook_categories")
      .select("id").eq("is_active", true).ilike("name", `%${search}%`).limit(100);
    const terms = [`title.ilike.%${search}%`, `author_name.ilike.%${search}%`, `subject.ilike.%${search}%`, `exam.ilike.%${search}%`];
    if (matchingCategories?.length) terms.push(`category_id.in.(${matchingCategories.map((category) => category.id).join(",")})`);
    query = query.or(terms.join(","));
  }
  if (filters.category) query = query.eq("ebook_categories.slug", filters.category);
  if (filters.subject) query = query.eq("subject", filters.subject);
  if (filters.exam) query = query.eq("exam", filters.exam);
  if (filters.author) query = query.eq("ebook_contributors.slug", filters.author);
  if (filters.language) query = query.eq("language", filters.language);
  if (filters.featured) query = query.eq("is_featured", true);
  if (filters.price === "free") query = query.eq("price", 0);
  if (filters.price === "paid") query = query.gt("price", 0);
  if (filters.minPrice !== undefined) query = query.gte("price", filters.minPrice);
  if (filters.maxPrice !== undefined) query = query.lte("price", filters.maxPrice);

  const sort = filters.sort ?? "latest";
  const column = sort === "popular" ? "view_count" : sort.startsWith("price") ? "price" : "published_at";
  const ascending = sort === "price_low";
  const { data, error, count } = await query
    .order(column, { ascending, nullsFirst: false })
    .range(offset, offset + limit - 1);
  if (error) {
    console.error("Could not load public eBook listings", error.message);
    return { books: [], total: 0, page, limit };
  }
  return { books: data ?? [], total: count ?? 0, page, limit };
}

export async function getPublishedEbookBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ebook_listings")
    .select("id, contributor_id, category_id, subject_id, exam_id, title, slug, cover_image_url, short_description, full_description, subject, exam, language, page_count, price, currency, preview_url, author_name, publication_date, status, is_featured, view_count, external_click_count, published_at, created_at, updated_at, ebook_categories(id, name, slug, description), ebook_contributors(id, slug, display_name, bio, expertise, profile_image_url, social_links)")
    .eq("slug", slug)
    .eq("status", "PUBLISHED")
    .maybeSingle();
  if (error) console.error("Could not load eBook listing", error.message);
  return data;
}

export async function getRelatedFreeMockTests(ebook: {
  subject_id?: string | null;
  exam_id?: string | null;
  subject?: string | null;
  exam?: string | null;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("mock_tests")
    .select("id, title, slug, description, duration_minutes, total_questions, subjects(name), exams(name)")
    .eq("is_published", true)
    .eq("is_active", true)
    .eq("is_premium", false)
    .gt("total_questions", 0)
    .gt("duration_minutes", 0);

  if (ebook.subject_id && ebook.exam_id) {
    query = query.or(`subject_id.eq.${ebook.subject_id},exam_id.eq.${ebook.exam_id}`);
  } else if (ebook.subject_id) {
    query = query.eq("subject_id", ebook.subject_id);
  } else if (ebook.exam_id) {
    query = query.eq("exam_id", ebook.exam_id);
  } else {
    const term = cleanSearch(ebook.subject || ebook.exam || "");
    if (!term) return [];
    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(4);
  if (error) {
    console.error("Could not load related free mock tests", error.message);
    return [];
  }
  return data ?? [];
}

export async function getPublicContributor(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ebook_contributors")
    .select("id, slug, display_name, bio, expertise, profile_image_url, social_links, qualification, teaching_experience, website_url, location, ebook_listings(id, title, slug, cover_image_url, short_description, author_name, price, currency, language, page_count, published_at, status, subject, exam, ebook_categories(name, slug))")
    .eq("slug", slug)
    .maybeSingle();
  if (error) console.error("Could not load public contributor", error.message);
  if (!data) return null;
  const books = (data.ebook_listings ?? []).filter((book) => book.status === "PUBLISHED");
  return { ...data, ebook_listings: books };
}

/** Distinct languages across published listings, for the discovery filter. */
export async function getPublishedLanguages(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ebook_listings")
    .select("language")
    .eq("status", "PUBLISHED")
    .order("language")
    .limit(2000);
  return [...new Set((data ?? []).map((row) => row.language).filter((value): value is string => Boolean(value)))];
}

export async function getPublishedEbookFacets() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ebook_listings")
    .select("subject, exam, language")
    .eq("status", "PUBLISHED")
    .limit(2000);
  if (error) {
    console.error("Could not load eBook search facets", error.message);
    return { subjects: [], exams: [], languages: [] };
  }
  const values = (key: "subject" | "exam" | "language") => [...new Set((data ?? [])
    .map((row) => row[key]?.trim())
    .filter((value): value is string => Boolean(value)))].sort((left, right) => left.localeCompare(right));
  return { subjects: values("subject"), exams: values("exam"), languages: values("language") };
}

/** Contributors who currently have at least one published listing. */
export async function getPublishedEbookAuthors(limit = 40) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ebook_contributors")
    .select("id, slug, display_name, ebook_listings!inner(id)")
    .order("display_name")
    .limit(limit);
  return (data ?? []).map((row) => ({ id: row.id, slug: row.slug, display_name: row.display_name }));
}

export async function getRelatedPublishedEbooks(input: {
  subjectId?: string | null;
  examId?: string | null;
  search?: string | null;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("ebook_listings")
    .select("id, title, slug, cover_image_url, short_description, subject, exam, language, page_count, price, currency, author_name, published_at, view_count, external_click_count, ebook_categories(name, slug), ebook_contributors(slug)")
    .eq("status", "PUBLISHED");

  if (input.subjectId && input.examId) {
    query = query.or(`subject_id.eq.${input.subjectId},exam_id.eq.${input.examId}`);
  } else if (input.subjectId) {
    query = query.eq("subject_id", input.subjectId);
  } else if (input.examId) {
    query = query.eq("exam_id", input.examId);
  } else {
    const term = input.search ? cleanSearch(input.search) : "";
    if (!term) return [];
    query = query.or(`title.ilike.%${term}%,subject.ilike.%${term}%,exam.ilike.%${term}%`);
  }

  const { data, error } = await query.order("published_at", { ascending: false, nullsFirst: false }).limit(4);
  if (error) {
    console.error("Could not load eBooks related to mock test", error.message);
    return [];
  }
  return data ?? [];
}

/** eBook ids the signed-in buyer has already paid for. */
export async function getPurchasedEbookIds(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ebook_transactions")
    .select("ebook_id")
    .eq("buyer_user_id", userId)
    .eq("status", "VERIFIED");
  return [...new Set((data ?? []).map((row) => row.ebook_id))];
}
