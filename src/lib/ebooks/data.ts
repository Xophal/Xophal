import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PUBLIC_EBOOK_CARD_SELECT =
  "id, title, slug, cover_image_url, short_description, subject, exam, language, page_count, price, currency, author_name, is_featured, published_at, subject_id, exam_id, category_id, ebook_categories(name, slug), ebook_contributors(slug)";

export type EbookFilters = {
  search?: string;
  category?: string;
  author?: string;
  subject?: string;
  exam?: string;
  language?: string;
  price?: "free" | "paid" | "under50" | "50to99" | "100to199" | "200to399" | "400plus";
  minPrice?: number;
  maxPrice?: number;
  sort?: "latest" | "oldest" | "price_low" | "price_high" | "az";
  featured?: boolean;
  page?: number;
  limit?: number;
};

function cleanSearch(value: string) {
  return value.trim().replace(/[%,_()]/g, " ").slice(0, 100);
}

export async function getEbookCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ebook_categories")
    .select("id, name, slug, description")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listPublishedEbooks(filters: EbookFilters = {}) {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const limit = Math.min(24, Math.max(1, Math.floor(filters.limit ?? 12)));
  const offset = (page - 1) * limit;
  const supabase = await createClient();
  const contributorSelection = filters.author ? "ebook_contributors!inner(slug)" : "ebook_contributors(slug)";
  let query = supabase
    .from("ebook_listings")
    .select(`id, title, slug, cover_image_url, short_description, subject, exam, language, page_count, price, currency, author_name, is_featured, published_at, view_count, external_click_count, category_id, ebook_categories(name, slug, is_active), ${contributorSelection}`, { count: "exact" })
    .eq("status", "PUBLISHED");

  const search = filters.search ? cleanSearch(filters.search) : "";
  if (search) {
    const { data: matchingCategories, error: categoriesError } = await supabase.from("ebook_categories")
      .select("id").eq("is_active", true).ilike("name", `%${search}%`).limit(100);
    if (categoriesError) throw categoriesError;
    const terms = [`title.ilike.%${search}%`, `author_name.ilike.%${search}%`, `subject.ilike.%${search}%`, `exam.ilike.%${search}%`];
    if (matchingCategories?.length) terms.push(`category_id.in.(${matchingCategories.map((category) => category.id).join(",")})`);
    query = query.or(terms.join(","));
  }
  if (filters.category) {
    const { data: category, error: categoryError } = await supabase.from("ebook_categories")
      .select("id").eq("slug", filters.category).eq("is_active", true).maybeSingle();
    if (categoryError) throw categoryError;
    if (!category) return { books: [], total: 0, page, limit };
    query = query.eq("category_id", category.id);
  }
  if (filters.subject) query = query.eq("subject", filters.subject);
  if (filters.exam) query = query.eq("exam", filters.exam);
  if (filters.author) query = query.eq("ebook_contributors.slug", filters.author);
  if (filters.language) query = query.eq("language", filters.language);
  if (filters.featured) query = query.eq("is_featured", true);
  if (filters.price === "free") query = query.eq("price", 0);
  if (filters.price === "paid") query = query.gt("price", 0);
  if (filters.price === "under50") query = query.gt("price", 0).lt("price", 50);
  if (filters.price === "50to99") query = query.gte("price", 50).lte("price", 99);
  if (filters.price === "100to199") query = query.gte("price", 100).lte("price", 199);
  if (filters.price === "200to399") query = query.gte("price", 200).lte("price", 399);
  if (filters.price === "400plus") query = query.gte("price", 400);
  if (filters.minPrice !== undefined) query = query.gte("price", filters.minPrice);
  if (filters.maxPrice !== undefined) query = query.lte("price", filters.maxPrice);

  const sort = filters.sort ?? "latest";
  // Spec §13: sorting is latest/oldest (published_at), price low/high, or A–Z by
  // title. "popular"/sales-based sorting stays disabled until real transaction
  // data exists, so "popular" is never offered as a public sort.
  const column = sort === "az" ? "title" : sort.startsWith("price") ? "price" : "published_at";
  const ascending = sort === "price_low" || sort === "oldest" || sort === "az";
  // Featured listings (admin-curated only, spec §14) pin to the top of the first
  // discovery page when no explicit sort/search is applied.
  const featuredFirst = !filters.search && (filters.sort === undefined || filters.sort === "latest");
  if (featuredFirst) {
    query = query.order("is_featured", { ascending: false, nullsFirst: false });
  }
  const { data, error, count } = await query
    .order(column, { ascending, nullsFirst: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return { books: data ?? [], total: count ?? 0, page, limit };
}

export async function getPublishedEbookBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ebook_listings")
    .select("id, contributor_id, category_id, subject_id, exam_id, title, slug, cover_image_url, short_description, full_description, subject, exam, language, page_count, price, currency, preview_url, author_name, publication_date, status, is_featured, view_count, external_click_count, published_at, created_at, updated_at, ebook_categories(id, name, slug, description, is_active), ebook_contributors(id, slug, display_name, bio, expertise, profile_image_url, social_links), exams!exam_id(id, slug, is_active), subjects!subject_id(id, slug, is_active, classes!inner(name, slug, is_active, boards!inner(name, slug, is_active)))")
    .eq("slug", slug)
    .eq("status", "PUBLISHED")
    .maybeSingle();
  if (error) throw error;
  return data;
}

type ManualEbookMockRelation = {
  mock_test_id: string;
  relation_type: "RELATED" | "RECOMMENDED" | "PRIMARY" | "EXCLUDED";
  priority: number;
};

function buildTaxonomyFilters(input: { examId?: string | null; subjectId?: string | null }) {
  const filters: string[] = [];
  if (input.examId) filters.push(`exam_id.eq.${input.examId}`);
  if (input.subjectId) filters.push(`subject_id.eq.${input.subjectId}`);
  return filters;
}

export async function getRecommendedMockTestsForEbook(ebook: {
  id: string;
  subject_id?: string | null;
  exam_id?: string | null;
}) {
  const admin = createAdminClient();
  const { data: relations, error: relationsError } = await admin
    .from("ebook_mock_test_relations")
    .select("mock_test_id, relation_type, priority")
    .eq("ebook_id", ebook.id)
    .order("priority", { ascending: true });
  if (relationsError) throw relationsError;

  const manualRelations = (relations ?? []) as ManualEbookMockRelation[];
  const excludedIds = new Set(
    manualRelations.filter((relation) => relation.relation_type === "EXCLUDED").map((relation) => relation.mock_test_id),
  );
  const relationByTestId = new Map(manualRelations.map((relation) => [relation.mock_test_id, relation]));
  const manualIds = manualRelations
    .filter((relation) => relation.relation_type !== "EXCLUDED")
    .map((relation) => relation.mock_test_id);
  const taxonomyFilters = buildTaxonomyFilters({ examId: ebook.exam_id, subjectId: ebook.subject_id });

  if (!taxonomyFilters.length && manualIds.length === 0) return [];

  const testSelect = "id, title, slug, description, duration_minutes, total_questions, is_premium, subject_id, exam_id, subjects(name), exams(name)";
  const [manualResult, taxonomyResult] = await Promise.all([
    manualIds.length
      ? admin
        .from("mock_tests")
        .select(testSelect)
        .eq("is_published", true)
        .eq("is_active", true)
        .gt("total_questions", 0)
        .gt("duration_minutes", 0)
        .in("id", manualIds)
      : Promise.resolve(null),
    taxonomyFilters.length
      ? admin
        .from("mock_tests")
        .select(testSelect)
        .eq("is_published", true)
        .eq("is_active", true)
        .gt("total_questions", 0)
        .gt("duration_minutes", 0)
        .or(taxonomyFilters.join(","))
        .order("created_at", { ascending: false })
        .limit(100)
      : Promise.resolve(null),
  ]);
  if (manualResult?.error) throw manualResult.error;
  if (taxonomyResult?.error) throw taxonomyResult.error;
  const tests = [...(manualResult?.data ?? []), ...(taxonomyResult?.data ?? [])];
  const uniqueTests = [...new Map(tests.map((test) => [test.id, test])).values()];

  const scored = uniqueTests
    .filter((test) => !excludedIds.has(test.id))
    .map((test) => {
      const relation = relationByTestId.get(test.id);
      const relevanceScore =
        (ebook.exam_id && test.exam_id === ebook.exam_id ? 100 : 0) +
        (ebook.subject_id && test.subject_id === ebook.subject_id ? 60 : 0);
      const manualRank = relation?.relation_type === "PRIMARY"
        ? 0
        : relation?.relation_type === "RECOMMENDED"
          ? 1
          : relation?.relation_type === "RELATED"
            ? 2
            : 3;
      if (!relation && relevanceScore === 0) return null;
      return { test, relevanceScore, manualRank, priority: relation?.priority ?? Number.MAX_SAFE_INTEGER };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) =>
      left.manualRank - right.manualRank ||
      left.priority - right.priority ||
      right.relevanceScore - left.relevanceScore ||
      left.test.title.localeCompare(right.test.title),
    )
    .slice(0, 6);

  return scored.map(({ test }) => test);
}

export async function getRelatedFreeMockTests(ebook: {
  id: string;
  subject_id?: string | null;
  exam_id?: string | null;
}) {
  return getRecommendedMockTestsForEbook(ebook);
}

/**
 * Data for an exam landing page (spec §19). Returns null when the exam is
 * unknown/inactive OR has no published eBooks, so thin exam pages are never
 * rendered or indexed.
 */
export async function getExamLandingData(slug: string) {
  const supabase = await createClient();
  const { data: exam, error } = await supabase
    .from("exams")
    .select("id, name, slug, description")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!exam) return null;

  const select = "id, title, slug, cover_image_url, short_description, subject, exam, language, page_count, price, currency, author_name, is_featured, published_at, subject_id, exam_id, category_id, ebook_categories(name, slug, is_active), ebook_contributors(slug), subjects!subject_id(name, slug, is_active, classes!inner(name, slug, is_active, boards!inner(name, slug, is_active)))";
  const [byId, byName] = await Promise.all([
    supabase
      .from("ebook_listings")
      .select(select)
      .eq("status", "PUBLISHED")
      .eq("exam_id", exam.id)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(24),
    supabase
      .from("ebook_listings")
      .select(select)
      .eq("status", "PUBLISHED")
      .eq("exam", exam.name)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(24),
  ]);
  if (byId.error) throw byId.error;
  if (byName.error) throw byName.error;
  const seen = new Set<string>();
  const books = [...(byId.data ?? []), ...(byName.data ?? [])].filter((book) => {
    if (seen.has(book.id)) return false;
    seen.add(book.id);
    return true;
  }).slice(0, 24);
  if (!books.length) return null;

  const subjectsBySlug = new Map<string, { name: string; slug: string; classSlug: string; boardSlug: string }>();
  for (const book of books) {
    const subject = Array.isArray(book.subjects) ? book.subjects[0] : book.subjects;
    const classInfo = subject && (Array.isArray(subject.classes) ? subject.classes[0] : subject.classes);
    const board = classInfo && (Array.isArray(classInfo.boards) ? classInfo.boards[0] : classInfo.boards);
    if (subject?.is_active && classInfo?.is_active && board?.is_active && subject.slug && classInfo.slug && board.slug) {
      const key = `${board.slug}/${classInfo.slug}/${subject.slug}`;
      subjectsBySlug.set(key, { name: subject.name, slug: subject.slug, classSlug: classInfo.slug, boardSlug: board.slug });
    }
  }
  const subjects = [...subjectsBySlug.values()].sort((left, right) => left.name.localeCompare(right.name));
  const categorySlugs = [...new Set(books.map((book) => {
    const relation = Array.isArray(book.ebook_categories) ? book.ebook_categories[0] : book.ebook_categories;
    return relation?.slug;
  }).filter((value): value is string => Boolean(value)))];

  const [testsResult, relatedExamsResult] = await Promise.all([
    supabase
      .from("mock_tests")
      .select("id, title, slug, description, total_questions, duration_minutes, is_premium, exam_id, subjects(name), exams(name)")
      .eq("exam_id", exam.id)
      .eq("is_published", true)
      .eq("is_active", true)
      .gt("total_questions", 0)
      .gt("duration_minutes", 0)
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("exams")
      .select("id, name, slug, ebook_listings!inner(id)")
      .eq("is_active", true)
      .eq("ebook_listings.status", "PUBLISHED")
      .neq("id", exam.id)
      .order("sort_order")
      .limit(6),
  ]);
  if (testsResult.error) throw testsResult.error;
  if (relatedExamsResult.error) throw relatedExamsResult.error;

  return {
    exam,
    books,
    subjects,
    categorySlugs,
    relatedTests: testsResult.data ?? [],
    relatedExams: (relatedExamsResult.data ?? []).map(({ name, slug: examSlug }) => ({ name, slug: examSlug })),
  };
}

export async function getSubjectLandingData(
  boardSlug: string,
  classSlug: string,
  slug: string,
  requestedPage = 1,
) {
  const page = Math.max(1, Math.floor(requestedPage));
  const pageSize = 24;
  const offset = (page - 1) * pageSize;
  const supabase = await createClient();
  const { data: subject, error: subjectError } = await supabase
    .from("subjects")
    .select("id, name, slug, description, classes!inner(name, slug, is_active, boards!inner(name, slug, is_active))")
    .eq("slug", slug)
    .eq("is_active", true)
    .eq("classes.slug", classSlug)
    .eq("classes.is_active", true)
    .eq("classes.boards.slug", boardSlug)
    .eq("classes.boards.is_active", true)
    .maybeSingle();
  if (subjectError) throw subjectError;
  if (!subject) return null;
  const classInfo = Array.isArray(subject.classes) ? subject.classes[0] : subject.classes;
  const board = classInfo && (Array.isArray(classInfo.boards) ? classInfo.boards[0] : classInfo.boards);
  if (!classInfo || !board) return null;

  const [booksResult, testsResult] = await Promise.all([
    supabase
      .from("ebook_listings")
      .select(PUBLIC_EBOOK_CARD_SELECT, { count: "exact" })
      .eq("status", "PUBLISHED")
      .eq("subject_id", subject.id)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("id")
      .range(offset, offset + pageSize - 1),
    supabase
      .from("mock_tests")
      .select("id, title, slug, description, total_questions, duration_minutes, is_premium, subjects(name), exams(name)")
      .eq("subject_id", subject.id)
      .eq("is_published", true)
      .eq("is_active", true)
      .gt("total_questions", 0)
      .gt("duration_minutes", 0)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  if (booksResult.error) throw booksResult.error;
  if (testsResult.error) throw testsResult.error;

  const total = booksResult.count ?? 0;
  if (total === 0 || offset >= total) return null;

  return {
    subject,
    classInfo,
    board,
    books: booksResult.data ?? [],
    relatedTests: testsResult.data ?? [],
    total,
    page,
    pageSize,
  };
}

export async function getPublicContributor(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ebook_contributors")
    .select("id, slug, display_name, bio, expertise, profile_image_url, social_links, qualification, teaching_experience, website_url, location")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { count, error: countError } = await supabase
    .from("ebook_listings")
    .select("id", { count: "exact", head: true })
    .eq("contributor_id", data.id)
    .eq("status", "PUBLISHED");
  if (countError) throw countError;
  if (!count) return null;

  return {
    slug: data.slug,
    display_name: data.display_name,
    bio: data.bio,
    expertise: data.expertise,
    profile_image_url: data.profile_image_url,
    social_links: data.social_links,
    qualification: data.qualification,
    teaching_experience: data.teaching_experience,
    website_url: data.website_url,
    location: data.location,
    publishedCount: count,
  };
}

export async function getPublicContributorEbooks(slug: string, requestedPage = 1) {
  const page = Math.max(1, Math.floor(requestedPage));
  const limit = 24;
  const offset = (page - 1) * limit;
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("ebook_listings")
    .select("id, title, slug, cover_image_url, short_description, subject_id, exam_id, subject, exam, language, page_count, price, currency, author_name, is_featured, published_at, category_id, ebook_categories(name, slug, is_active), ebook_contributors!inner(slug, display_name)", { count: "exact" })
    .eq("status", "PUBLISHED")
    .eq("ebook_contributors.slug", slug)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("id")
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return { books: data ?? [], total: count ?? 0, page, limit };
}

export async function getRelatedMockTestsForEbooks(
  ebooks: Array<{ subject_id?: string | null; exam_id?: string | null }>,
) {
  const examIds = [...new Set(ebooks.map((ebook) => ebook.exam_id).filter((id): id is string => Boolean(id)))];
  const subjectIds = [...new Set(ebooks.map((ebook) => ebook.subject_id).filter((id): id is string => Boolean(id)))];
  const filters = [
    ...(examIds.length ? [`exam_id.in.(${examIds.join(",")})`] : []),
    ...(subjectIds.length ? [`subject_id.in.(${subjectIds.join(",")})`] : []),
  ];
  if (!filters.length) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mock_tests")
    .select("id, title, slug, description, duration_minutes, total_questions, is_premium, subject_id, exam_id, subjects(name), exams(name)")
    .eq("is_published", true)
    .eq("is_active", true)
    .gt("total_questions", 0)
    .gt("duration_minutes", 0)
    .or(filters.join(","))
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  return (data ?? [])
    .map((test) => ({
      test,
      relevanceScore: Math.max(
        ...ebooks.map((ebook) =>
          (ebook.exam_id && ebook.exam_id === test.exam_id ? 100 : 0) +
          (ebook.subject_id && ebook.subject_id === test.subject_id ? 60 : 0),
        ),
      ),
    }))
    .filter(({ relevanceScore }) => relevanceScore > 0)
    .sort((left, right) =>
      right.relevanceScore - left.relevanceScore ||
      left.test.title.localeCompare(right.test.title),
    )
    .slice(0, 4)
    .map(({ test }) => test);
}

/** Distinct languages across published listings, for the discovery filter. */
export async function getPublishedLanguages(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ebook_listings")
    .select("language")
    .eq("status", "PUBLISHED")
    .order("language")
    .limit(2000);
  if (error) throw error;
  return [...new Set((data ?? []).map((row) => row.language).filter((value): value is string => Boolean(value)))];
}

export async function getPublishedEbookFacets() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ebook_listings")
    .select("subject, exam, language")
    .eq("status", "PUBLISHED")
    .limit(2000);
  if (error) throw error;
  const values = (key: "subject" | "exam" | "language") => [...new Set((data ?? [])
    .map((row) => row[key]?.trim())
    .filter((value): value is string => Boolean(value)))].sort((left, right) => left.localeCompare(right));
  return { subjects: values("subject"), exams: values("exam"), languages: values("language") };
}

/** Contributors who currently have at least one published listing. */
export async function getPublishedEbookAuthors(limit = 40) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ebook_contributors")
    .select("slug, display_name, ebook_listings!inner(id)")
    .eq("ebook_listings.status", "PUBLISHED")
    .order("display_name")
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({ slug: row.slug, display_name: row.display_name }));
}

export async function getRelatedPublishedEbooks(input: {
  mockTestId?: string;
  subjectId?: string | null;
  examId?: string | null;
}) {
  const admin = createAdminClient();
  const relationsQuery = input.mockTestId
    ? await admin
        .from("ebook_mock_test_relations")
        .select("ebook_id, relation_type, priority")
        .eq("mock_test_id", input.mockTestId)
        .order("priority", { ascending: true })
    : { data: [], error: null };
  if (relationsQuery.error) throw relationsQuery.error;

  const relations = (relationsQuery.data ?? []) as Array<{
    ebook_id: string;
    relation_type: "RELATED" | "RECOMMENDED" | "PRIMARY" | "EXCLUDED";
    priority: number;
  }>;
  const excludedIds = new Set(
    relations.filter((relation) => relation.relation_type === "EXCLUDED").map((relation) => relation.ebook_id),
  );
  const relationByEbookId = new Map(relations.map((relation) => [relation.ebook_id, relation]));
  const manualIds = relations.filter((relation) => relation.relation_type !== "EXCLUDED").map((relation) => relation.ebook_id);
  const taxonomyFilters = buildTaxonomyFilters({ examId: input.examId, subjectId: input.subjectId });
  if (!taxonomyFilters.length && manualIds.length === 0) return [];

  const ebookSelect = "id, title, slug, cover_image_url, short_description, subject_id, exam_id, subject, exam, language, page_count, price, currency, author_name, published_at, category_id, ebook_categories(name, slug, is_active), ebook_contributors(slug)";
  const [manualBooksResult, taxonomyBooksResult] = await Promise.all([
    manualIds.length
      ? admin
        .from("ebook_listings")
        .select(ebookSelect)
        .eq("status", "PUBLISHED")
        .in("id", manualIds)
      : Promise.resolve(null),
    taxonomyFilters.length
      ? admin
        .from("ebook_listings")
        .select(ebookSelect)
        .eq("status", "PUBLISHED")
        .or(taxonomyFilters.join(","))
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(100)
      : Promise.resolve(null),
  ]);
  if (manualBooksResult?.error) throw manualBooksResult.error;
  if (taxonomyBooksResult?.error) throw taxonomyBooksResult.error;
  const books = [
    ...(manualBooksResult?.data ?? []),
    ...(taxonomyBooksResult?.data ?? []),
  ];
  const uniqueBooks = [...new Map(books.map((book) => [book.id, book])).values()];

  return uniqueBooks
    .filter((book) => !excludedIds.has(book.id))
    .map((book) => {
      const relation = relationByEbookId.get(book.id);
      const relevanceScore =
        (input.examId && book.exam_id === input.examId ? 100 : 0) +
        (input.subjectId && book.subject_id === input.subjectId ? 60 : 0);
      const manualRank = relation?.relation_type === "PRIMARY"
        ? 0
        : relation?.relation_type === "RECOMMENDED"
          ? 1
          : relation?.relation_type === "RELATED"
            ? 2
            : 3;
      if (!relation && relevanceScore === 0) return null;
      return { book, relevanceScore, manualRank, priority: relation?.priority ?? Number.MAX_SAFE_INTEGER };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) =>
      left.manualRank - right.manualRank ||
      left.priority - right.priority ||
      right.relevanceScore - left.relevanceScore ||
      left.book.title.localeCompare(right.book.title),
    )
    .slice(0, 6)
    .map(({ book }) => book);
}

export async function getRelatedEbooksForEbook(input: {
  id: string;
  categoryId?: string | null;
  subjectId?: string | null;
  examId?: string | null;
}) {
  const filters = buildTaxonomyFilters({ examId: input.examId, subjectId: input.subjectId });
  if (input.categoryId) filters.push(`category_id.eq.${input.categoryId}`);
  if (!filters.length) return [];

  const { data, error } = await createAdminClient()
    .from("ebook_listings")
    .select("id, title, slug, cover_image_url, short_description, subject_id, exam_id, subject, exam, language, page_count, price, currency, author_name, published_at, category_id, ebook_categories(name, slug, is_active), ebook_contributors(slug)")
    .eq("status", "PUBLISHED")
    .neq("id", input.id)
    .or(filters.join(","))
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) throw error;

  return (data ?? [])
    .map((book) => ({
      book,
      relevanceScore:
        (input.examId && book.exam_id === input.examId ? 100 : 0) +
        (input.subjectId && book.subject_id === input.subjectId ? 60 : 0) +
        (input.categoryId && book.category_id === input.categoryId ? 30 : 0),
    }))
    .filter((item) => item.relevanceScore > 0)
    .sort((left, right) =>
      right.relevanceScore - left.relevanceScore ||
      left.book.title.localeCompare(right.book.title),
    )
    .slice(0, 4)
    .map(({ book }) => book);
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
