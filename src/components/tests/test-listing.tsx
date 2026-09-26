"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Clock3, FileQuestion, Search, SlidersHorizontal, Trophy, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type RelatedName = { name: string } | { name: string }[] | null;
type Test = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  total_questions: number;
  total_marks: number;
  duration_minutes: number;
  test_types: RelatedName & { code?: string };
  subjects: RelatedName;
  chapters: RelatedName;
};
type ListingResponse = {
  success: boolean;
  data?: { data: Test[]; pagination: { page: number; totalPages: number; total: number; hasMore: boolean } };
  error?: string;
};

function mergeUniqueTests(current: Test[], incoming: Test[]) {
  const merged = new Map<string, Test>();
  [...current, ...incoming].forEach((test) => merged.set(test.id, test));
  return Array.from(merged.values());
}

function relatedName(value: RelatedName) {
  return (Array.isArray(value) ? value[0] : value)?.name || null;
}

export function TestListing() {
  const initialSearch =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("search") || "" : "";
  const [tests, setTests] = useState<Test[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);
  const [testType, setTestType] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadTests() {
      setStatus("loading");
      try {
        const params = new URLSearchParams({ page: String(page), limit: "9", sort });
        if (search) params.set("search", search);
        if (testType) params.set("testType", testType);
        const response = await fetch(`/api/mock-tests?${params}`, { signal: controller.signal });
        const payload = (await response.json()) as ListingResponse;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error || "Unable to load tests");
        }
        setTests((current) =>
          page === 1 ? mergeUniqueTests([], payload.data!.data) : mergeUniqueTests(current, payload.data!.data)
        );
        setHasMore(payload.data.pagination.hasMore);
        setTotal(payload.data.pagination.total);
        setStatus("ready");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setStatus("error");
      }
    }
    loadTests();
    return () => controller.abort();
  }, [page, search, sort, testType, reloadKey]);

  const categories = useMemo(
    () =>
      Array.from(
        new Map(
          tests
            .map((test) => {
              const type = Array.isArray(test.test_types) ? test.test_types[0] : test.test_types;
              return type && "code" in type ? [type.code, type.name] : null;
            })
            .filter((value): value is [string, string] => value !== null)
        ).entries()
      ),
    [tests]
  );

  const hasFilters = Boolean(searchInput || testType || sort !== "newest");
  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setTestType("");
    setSort("newest");
    setPage(1);
  };

  return (
    <main className="min-h-screen bg-background pt-20">
      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="exam-eyebrow">Mock tests</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Find your next practice test
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Board-focused papers with real timing, negative marking, and a full question review at the end.
          </p>
        </div>

        <div className="exam-panel mt-8 p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <label htmlFor="test-search" className="sr-only">
                Search mock tests
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="test-search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by test title or description"
                className="pl-10 pr-10"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div>
              <label htmlFor="test-type" className="sr-only">
                Filter by test type
              </label>
              <select
                id="test-type"
                value={testType}
                onChange={(event) => {
                  setTestType(event.target.value);
                  setPage(1);
                }}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-48"
              >
                <option value="">All test types</option>
                {categories.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="test-sort" className="sr-only">
                Sort tests
              </label>
              <select
                id="test-sort"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-40"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="alphabetical">A to Z</option>
              </select>
            </div>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear all filters
            </button>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {status === "ready"
              ? `${total} ${total === 1 ? "test" : "tests"} available`
              : status === "error"
                ? "Could not load tests"
                : "Loading tests"}
          </p>
          {hasFilters && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Filters applied
            </span>
          )}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {status === "loading" &&
            tests.length === 0 &&
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="exam-panel p-5">
                <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
                <div className="mt-4 h-6 w-4/5 animate-pulse rounded bg-muted" />
                <div className="mt-3 h-4 w-full animate-pulse rounded bg-muted" />
                <div className="mt-6 h-10 w-full animate-pulse rounded-lg bg-muted" />
              </div>
            ))}

          {status === "error" && (
            <div className="exam-panel p-8 text-center md:col-span-2 xl:col-span-3" role="alert">
              <h2 className="exam-section-title">We could not load mock tests</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Please check your connection and try again. Nothing was lost.
              </p>
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="mt-5 min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Try again
              </button>
            </div>
          )}

          {status === "ready" && tests.length === 0 && (
            <div className="exam-panel p-8 text-center md:col-span-2 xl:col-span-3">
              <FileQuestion className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <h2 className="mt-4 exam-section-title">No tests found</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                No mock test matches these filters yet. Try a different search or clear them to see
                everything.
              </p>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 min-h-11 rounded-lg border border-border px-5 text-sm font-semibold transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {tests.map((test) => {
            const subject = relatedName(test.subjects);
            const chapter = relatedName(test.chapters);
            const type = relatedName(test.test_types);
            return (
              <article key={test.id} className="exam-panel flex h-full flex-col p-5 transition hover:border-primary/40">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[0.6875rem] font-bold text-primary">
                    {type || "Mock test"}
                  </span>
                  {subject && (
                    <span className="text-[0.6875rem] font-semibold text-muted-foreground">{subject}</span>
                  )}
                </div>

                <h2 className="mt-3 text-lg font-bold leading-snug text-foreground">{test.title}</h2>
                {test.description && (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {test.description}
                  </p>
                )}
                {chapter && <p className="mt-2 text-xs text-muted-foreground">Topic: {chapter}</p>}

                <dl className="mt-5 grid grid-cols-3 gap-2 border-y border-border py-3">
                  <div>
                    <dt className="exam-stat__label text-[0.625rem]">Duration</dt>
                    <dd className="mt-1 inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
                      <Clock3 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      {test.duration_minutes}m
                    </dd>
                  </div>
                  <div>
                    <dt className="exam-stat__label text-[0.625rem]">Questions</dt>
                    <dd className="mt-1 inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
                      <FileQuestion className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      {test.total_questions}
                    </dd>
                  </div>
                  <div>
                    <dt className="exam-stat__label text-[0.625rem]">Marks</dt>
                    <dd className="mt-1 inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
                      <Trophy className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      {test.total_marks}
                    </dd>
                  </div>
                </dl>

                <Link
                  href={`/test/${test.slug}`}
                  className={cn(
                    "mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold",
                    "bg-primary text-primary-foreground transition hover:opacity-90",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  )}
                >
                  View test
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </article>
            );
          })}
        </div>

        {status === "ready" && hasMore && (
          <div className="mt-10 text-center">
            <button
              type="button"
              onClick={() => setPage((value) => value + 1)}
              className="min-h-11 rounded-lg border border-border bg-card px-5 text-sm font-semibold transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Load more tests
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
