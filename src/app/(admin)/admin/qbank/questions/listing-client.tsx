"use client";

import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type TaxonomyItem = { id: string; code: string; name: string };

interface QuestionRow {
  id: string;
  question_text: string;
  status: string;
  engine_status: string;
  marks: number;
  difficulty: number;
  subjects?: Relation<{ code: string; name: string; classes?: Relation<{ code: string; name: string; boards?: Relation<{ code: string; name: string }> }> }>;
  chapters?: { code: string; name: string } | null;
  topics?: { code: string; name: string } | null;
}

type Relation<T> = T | T[] | null;

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface QuestionResponse extends Pagination {
  rows: QuestionRow[];
}

const STATUS_BADGE: Record<string, "secondary" | "success" | "destructive"> = {
  draft: "secondary", review: "secondary", approved: "success",
  published: "success", rejected: "destructive", archived: "secondary",
};

async function fetchQuestions(params: URLSearchParams) {
  const res = await fetch(`/api/admin/qbank/questions?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch questions");
  return res.json();
}

export function QuestionListingClient() {
  const [supabase] = useState(() => createClient());
  const [query, setQuery] = useState<URLSearchParams>(new URLSearchParams({ page: "1", limit: "20" }));
  const [data, setData] = useState<QuestionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [taxonomy, setTaxonomy] = useState<Record<string, TaxonomyItem[]>>({
    boards: [], classes: [], subjects: [], chapters: [], topics: [],
  });
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      supabase.from("boards").select("id, code, name").eq("is_active", true).order("name"),
      supabase.from("classes").select("id, code, name").eq("is_active", true).order("name"),
      supabase.from("subjects").select("id, code, name").eq("is_active", true).order("name"),
      supabase.from("chapters").select("id, code, name").eq("is_active", true).order("name"),
      supabase.from("topics").select("id, code, name").eq("is_active", true).order("name"),
    ]).then(([boards, classes, subjects, chapters, topics]) => {
      const error = boards.error ?? classes.error ?? subjects.error ?? chapters.error ?? topics.error;
      if (error) throw error;
      if (!cancelled) {
        setTaxonomy({
          boards: boards.data ?? [],
          classes: classes.data ?? [],
          subjects: subjects.data ?? [],
          chapters: chapters.data ?? [],
          topics: topics.data ?? [],
        });
      }
    }).catch((error: unknown) => {
      if (!cancelled) setLoadError(error instanceof Error ? error.message : "Could not load question filters.");
    });
    return () => { cancelled = true; };
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const response = await fetchQuestions(query);
        if (!response.success) throw new Error(response.error || "Failed to fetch questions");
        if (!cancelled) setData(response.data);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setData({ rows: [], total: 0, page: 1, limit: 20, totalPages: 0, hasMore: false });
          setLoadError(err instanceof Error ? err.message : "Could not load questions.");
        }
      }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [query]);

  const setFilter = (key: string, value: string) => {
    const p = new URLSearchParams(query.toString());
    if (value && value !== "all") p.set(key, value); else p.delete(key);
    p.set("page", "1");
    setQuery(p);
  };

  const rows = data?.rows ?? [];
  const pagination = data;
  const statusOptions = ["draft", "review", "approved", "published", "rejected", "archived"];
  const difficultyOptions = ["easy", "medium", "hard"];
  const typeOptions = ["single_correct", "multiple_correct", "true_false", "fill_blank", "match_following", "assertion_reason", "numerical", "short_answer", "long_answer"];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
          <div className="flex items-center gap-2">
            <Input placeholder="Search questions..." value={query.get("search") ?? ""} onChange={(e) => setFilter("search", e.target.value)} />
            <Button variant="outline" size="sm" onClick={() => setFilter("search", "")}><Search size={14} /></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {([
              ["board_id", "Board", "boards"],
              ["class_id", "Class", "classes"],
              ["subject_id", "Subject", "subjects"],
              ["chapter_id", "Chapter", "chapters"],
              ["topic_id", "Topic", "topics"],
            ] as const).map(([field, label, key]) => (
              <Select key={field} value={query.get(field) ?? ""} onValueChange={(value) => setFilter(field, value ?? "")}>
                <SelectTrigger className="w-full"><SelectValue placeholder={label} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {label.toLowerCase()}s</SelectItem>
                  {taxonomy[key].map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ))}
            <Select value={query.get("status") ?? ""} onValueChange={(v) => setFilter("status", v ?? "")}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All statuses</SelectItem>{statusOptions.map((s) => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={query.get("difficulty") ?? ""} onValueChange={(v) => setFilter("difficulty", v ?? "")}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Difficulty" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All difficulties</SelectItem>{difficultyOptions.map((d) => <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={query.get("question_type") ?? ""} onValueChange={(v) => setFilter("question_type", v ?? "")}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All types</SelectItem>{typeOptions.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>)}</SelectContent>
            </Select>
            <Input aria-label="Language" placeholder="Language (e.g. en)" value={query.get("language") ?? ""} onChange={(event) => setFilter("language", event.target.value)} />
            <Input aria-label="Import batch ID" placeholder="Import batch ID" value={query.get("import_batch_id") ?? ""} onChange={(event) => setFilter("import_batch_id", event.target.value)} />
            <Input aria-label="Created from" type="date" value={query.get("created_from") ?? ""} onChange={(event) => setFilter("created_from", event.target.value)} />
            <Input aria-label="Created to" type="date" value={query.get("created_to") ?? ""} onChange={(event) => setFilter("created_to", event.target.value)} />
          </div>
        </CardContent>
      </Card>

      {loadError && <p role="alert" className="text-sm text-destructive">{loadError}</p>}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-bold">Questions ({pagination?.total ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">No questions found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-xs font-medium uppercase text-muted-foreground">ID</th>
                    <th className="px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Question</th>
                    <th className="px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Board / class</th>
                    <th className="px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Subject / chapter</th>
                    <th className="px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Status</th>
                    <th className="px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Difficulty</th>
                    <th className="px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Marks</th>
                    <th className="px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border">
                      <td className="px-3 py-2 font-mono text-xs">{row.id.slice(0, 8)}...</td>
                      <td className="max-w-[300px] truncate px-3 py-2">{row.question_text}</td>
                      <td className="px-3 py-2 text-xs">
                        {relationOne(relationOne(row.subjects)?.classes)?.boards
                          ? relationOne(relationOne(relationOne(row.subjects)?.classes)?.boards)?.name
                          : "—"}
                        {" / "}
                        {relationOne(relationOne(row.subjects)?.classes)?.name ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">{relationOne(row.subjects)?.name ?? "—"} / {row.chapters?.name ?? "—"}</td>
                      <td className="px-3 py-2"><Badge variant={STATUS_BADGE[row.status] ?? "secondary"}>{row.status}</Badge></td>
                      <td className="px-3 py-2 text-xs">{row.difficulty}</td>
                      <td className="px-3 py-2 text-xs">{row.marks}</td>
                      <td className="px-3 py-2"><Button size="sm" asChild><a href={`/admin/questions/${row.id}`}>Edit</a></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button disabled={pagination.page === 1} onClick={() => setQuery(setPage(query, pagination.page - 1))}><ChevronLeft size={14} /> Prev</Button>
          <span className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.totalPages}</span>
          <Button disabled={!pagination.hasMore} onClick={() => setQuery(setPage(query, pagination.page + 1))}>Next <ChevronRight size={14} /></Button>
        </div>
      )}
    </div>
  );
}

function relationOne<T>(value: Relation<T> | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function setPage(params: URLSearchParams, page: number): URLSearchParams {
  const p = new URLSearchParams(params.toString());
  p.set("page", String(page));
  return p;
}