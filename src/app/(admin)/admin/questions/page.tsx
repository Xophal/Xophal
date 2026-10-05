"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileQuestion,
  Filter,
  Layers3,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import EngineQuestionEditor, {
  parseEngineVocab,
  type EngineQuestionRow,
  type EngineVocab,
} from "@/components/admin/EngineQuestionEditor";
import { AdminEmpty, AdminPage, AdminStat } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { EngineStatus } from "@/lib/engine/vocab";
import { ENGINE_STATUSES, ENGINE_TYPES } from "@/lib/engine/vocab";

type Pagination = { page: number; limit: number; total: number; totalPages: number; hasMore: boolean };
type ListResponse = {
  success: boolean;
  data?: { data: EngineQuestionRow[]; pagination: Pagination };
  error?: string;
};

const STATUS_BADGE: Record<EngineStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  reviewed: "outline",
  published: "default",
  retired: "destructive",
};

const CSV_TEMPLATE_HEADER =
  "type,stem,topic_slug,subtopic_slug,difficulty,skill,marks,neg_marks,est_time_sec,board_pattern,status,source,tags,options,answer_json,rubric_json,explanation";

const CSV_TEMPLATE = [
  CSV_TEMPLATE_HEADER,
  'mcq,"Which gas turns limewater milky?",chemical-equations-balancing,,1,recall,1,0.25,60,CBSE,draft,import,"reactions|recall","[{""label"":""A"",""body"":""Oxygen"",""is_correct"":false},{""label"":""B"",""body"":""Carbon dioxide"",""is_correct"":true},{""label"":""C"",""body"":""Hydrogen"",""is_correct"":false},{""label"":""D"",""body"":""Nitrogen"",""is_correct"":false}]","{""correct_option"":""B""}","","Carbon dioxide reacts with limewater to form calcium carbonate."',
].join("\n");

const DEMO_CSV_URL = "/templates/questions-import-demo.csv";
const CSV_TEMPLATE_URL = "/templates/questions-import-template.csv";

/** Column-by-column guide so users can match their own sheet to the importer. */
const DEMO_COLUMN_GUIDE: Array<{ column: string; required: boolean; example: string; notes: string }> = [
  { column: "type", required: true, example: "mcq", notes: "One of: mcq, assertion_reason, match, statement, case_based, fill_blank, equation, short, long" },
  { column: "stem", required: true, example: "Which gas turns limewater milky?", notes: "The question text. Wrap in quotes if it contains commas." },
  { column: "topic_slug", required: true, example: "chemical-equations-balancing", notes: "Must already exist in Topics. Copy slug from /api/admin/engine/vocab." },
  { column: "subtopic_slug", required: false, example: "(blank)", notes: "Optional. Leave blank if unsure." },
  { column: "difficulty", required: true, example: "1", notes: "1 = easy, 2 = medium, 3 = hard." },
  { column: "skill", required: true, example: "recall", notes: "One of: recall, application, reasoning." },
  { column: "marks", required: false, example: "1", notes: "Defaults to 1." },
  { column: "neg_marks", required: false, example: "0.25", notes: "Defaults to 0." },
  { column: "est_time_sec", required: false, example: "60", notes: "Seconds. Defaults to 60." },
  { column: "board_pattern", required: false, example: "CBSE", notes: "One of: CBSE, SEBA, OTHER. Defaults to CBSE." },
  { column: "status", required: false, example: "draft", notes: "Keep draft. Imports are never auto-published." },
  { column: "source", required: false, example: "import", notes: "Keep import." },
  { column: "tags", required: false, example: "reactions|recall", notes: "Pipe-separated (|), max 30." },
  { column: "options", required: false, example: '[{"label":"A","body":"...","is_correct":false}]', notes: "MCQ needs 2-6 options, exactly 1 correct. Double the quotes inside CSV." },
  { column: "answer_json", required: false, example: '{"correct_option":"B"}', notes: 'MCQ: {"correct_option":"B"}. Fill-blank/equation/short have their own shape.' },
  { column: "rubric_json", required: false, example: '{"model_answer":"...","max_marks":2}', notes: "Only for short/long descriptive questions." },
  { column: "explanation", required: false, example: "CO2 forms calcium carbonate.", notes: "Shown to students after the attempt." },
];

function questionListPayload(response: ListResponse): { data: EngineQuestionRow[]; pagination: Pagination } {
  const payload = response?.data;
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const pagination =
    payload && typeof payload === "object" && payload.pagination
      ? (payload.pagination as Pagination)
      : { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false };

  return { data: rows, pagination };
}

export default function EngineQuestionsPage() {
  const [vocab, setVocab] = useState<EngineVocab | null>(null);
  const [rows, setRows] = useState<EngineQuestionRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [activeTab, setActiveTab] = useState("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/engine/vocab", { cache: "no-store" });
        const json = (await res.json()) as { success: boolean; data?: unknown; error?: string };
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error ?? "Failed to load question topics.");
        }
        setVocab(parseEngineVocab(json.data));
      } catch (error) {
        toast({
          title: "Vocab load failed",
          description: error instanceof Error ? error.message : "Topic dropdowns are unavailable.",
          variant: "destructive",
        });
      }
    })();
  }, []);


  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (search) params.set("search", search);
        if (typeFilter) params.set("type", typeFilter);
        if (statusFilter) params.set("status", statusFilter);
        if (topicFilter) params.set("topicId", topicFilter);
        if (difficultyFilter) params.set("difficulty", difficultyFilter);
        const res = await fetch(`/api/admin/engine/questions?${params.toString()}`, { cache: "no-store" });
        const json = (await res.json()) as ListResponse;
        if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load questions");
        const result = questionListPayload(json);
        if (active) {
          setRows(result.data);
          setPagination(result.pagination);
        }
      } catch (err) {
        if (active) {
          setLoadError(err instanceof Error ? err.message : String(err));
          toast({
            title: "Load failed",
            description: err instanceof Error ? err.message : String(err),
            variant: "destructive",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [page, search, typeFilter, statusFilter, topicFilter, difficultyFilter]);

  function resetFilters() {
    setPage(1);
    setSearch("");
    setTypeFilter("");
    setStatusFilter("");
    setTopicFilter("");
    setDifficultyFilter("");
  }

  async function transition(id: string, to: EngineStatus, reviewNotes: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/engine/questions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to, reviewNotes }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? "Transition failed");
      toast({ title: `Moved to ${to}` });
      await load();
    } catch (err) {
      toast({
        title: "Transition failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function archive(id: string) {
    if (!confirm("Archive this question? Referenced questions are retired, not deleted.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/engine/questions/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { success: boolean; data?: { mode?: string }; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? "Archive failed");
      toast({ title: json.data?.mode === "retired" ? "Retired (referenced by a test)" : "Deleted" });
      await load();
    } catch (err) {
      toast({
        title: "Archive failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function load() {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (typeFilter) params.set("type", typeFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (topicFilter) params.set("topicId", topicFilter);
      if (difficultyFilter) params.set("difficulty", difficultyFilter);
      const res = await fetch(`/api/admin/engine/questions?${params.toString()}`, { cache: "no-store" });
      const json = (await res.json()) as ListResponse;
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load questions");
      const result = questionListPayload(json);
      setRows(result.data);
      setPagination(result.pagination);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      toast({
        title: "Load failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }

  const counts = vocab?.reviewCounts ?? {};
  const totalQuestions = ENGINE_STATUSES.reduce((total, status) => total + Number(counts[status] ?? 0), 0);

  if (editingId || creating) {
    return (
      <AdminPage className="space-y-6">
        <Button
          variant="ghost"
          className="group gap-2 text-slate-300 hover:text-white"
          onClick={() => {
            setEditingId(null);
            setCreating(false);
          }}
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Back to question bank
        </Button>
        <div className="mx-auto w-full max-w-5xl">
          <EngineQuestionEditor
            questionId={editingId ?? undefined}
            onSaved={() => {
              setEditingId(null);
              setCreating(false);
              void load();
            }}
            onCancel={() => {
              setEditingId(null);
              setCreating(false);
            }}
          />
        </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage className="space-y-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-medium text-slate-400">
        <span>Assessments</span>
        <span aria-hidden="true" className="text-slate-600">/</span>
        <span className="text-slate-200">Question bank</span>
      </nav>

      <section className="premium-hero admin-hero relative overflow-hidden rounded-2xl border border-white/10 px-5 py-6 sm:px-8 sm:py-8">
        <div className="dashboard-hero-grid" aria-hidden="true" />
        <div className="premium-hero-glow premium-hero-glow--admin" aria-hidden="true" />
        <div className="relative z-10 grid gap-7 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-center">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/90">
              <Sparkles className="h-3.5 w-3.5 text-xophol-orange" aria-hidden="true" />
              Xophol assessment studio
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Build a better question bank.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50/75 sm:text-base">
              Create, organise and review high-quality questions for every learner, board and exam.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                className="min-h-11 gap-2 bg-xophol-orange px-5 font-semibold text-xophol-ink shadow-lg shadow-orange-950/20 hover:bg-xophol-orange/90"
                onClick={() => setCreating(true)}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create question
              </Button>
              <Button
                variant="outline"
                className="min-h-11 gap-2 border-white/20 bg-white/5 px-5 text-white hover:bg-white/10 hover:text-white"
                onClick={() => {
                  setActiveTab("import");
                  document.getElementById("question-workflows")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                Import questions
                <ArrowRight className="h-4 w-4 opacity-70" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-slate-950/30 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100/65">Bank overview</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-white">
                  {vocab ? totalQuestions.toLocaleString() : "—"}
                </p>
                <p className="text-xs text-blue-100/65">questions across all statuses</p>
              </div>
              <span className="grid h-12 w-12 place-items-center rounded-xl border border-xophol-orange/30 bg-xophol-orange/10 text-xophol-orange">
                <BookOpenCheck className="h-6 w-6" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
              <div>
                <p className="text-lg font-semibold text-white">{vocab?.topics.length ?? "—"}</p>
                <p className="text-xs text-blue-100/60">Topics</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-white">{ENGINE_TYPES.length}</p>
                <p className="text-xs text-blue-100/60">Question formats</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Question bank summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStat
          label="In review"
          value={Number(counts.draft ?? 0).toLocaleString()}
          hint="Drafts waiting for a reviewer"
          icon={Clock3}
          tone="amber"
        />
        <AdminStat
          label="Reviewed"
          value={Number(counts.reviewed ?? 0).toLocaleString()}
          hint="Ready for the next step"
          icon={CheckCircle2}
          tone="cyan"
        />
        <AdminStat
          label="Published"
          value={Number(counts.published ?? 0).toLocaleString()}
          hint="Available to build assessments"
          icon={BookOpenCheck}
          tone="emerald"
        />
        <AdminStat
          label="Formats"
          value={ENGINE_TYPES.length}
          hint="Flexible question types"
          icon={Layers3}
          tone="violet"
        />
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5" id="question-workflows">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-slate-950/45 p-1.5 sm:inline-flex sm:w-auto">
          <TabsTrigger
            value="list"
            className="min-h-11 gap-2 rounded-xl px-4 text-xs text-slate-300 data-[state=active]:bg-xophol-blue data-[state=active]:text-white sm:text-sm"
          >
            <FileQuestion className="h-4 w-4" aria-hidden="true" />
            Browse
          </TabsTrigger>
          <TabsTrigger
            value="queue"
            className="min-h-11 gap-2 rounded-xl px-4 text-xs text-slate-300 data-[state=active]:bg-xophol-blue data-[state=active]:text-white sm:text-sm"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Review queue
            {Number(counts.draft ?? 0) > 0 && (
              <span className="rounded-full bg-xophol-orange px-1.5 py-0.5 text-[10px] font-bold text-xophol-ink">
                {Number(counts.draft)}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="import"
            className="min-h-11 gap-2 rounded-xl px-4 text-xs text-slate-300 data-[state=active]:bg-xophol-blue data-[state=active]:text-white sm:text-sm"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            CSV import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-0 space-y-5">
          <section className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 shadow-lg shadow-slate-950/10 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-xophol-blue/20 text-blue-300">
                  <Filter className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-white">Find the right question</h2>
                  <p className="text-xs text-slate-400">Narrow the bank by content, status or curriculum.</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 text-slate-300 hover:text-white"
                onClick={resetFilters}
                disabled={!search && !typeFilter && !statusFilter && !topicFilter && !difficultyFilter}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Clear filters
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(15rem,1.5fr)_repeat(4,minmax(8rem,1fr))]">
              <div className="space-y-1.5">
                <Label htmlFor="f-search" className="text-xs text-slate-300">Search question</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                  <Input
                    id="f-search"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search by question text..."
                    className="h-10 rounded-xl border-white/10 bg-slate-950/50 pl-9 text-sm text-white placeholder:text-slate-500 focus-visible:ring-xophol-blue"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-type" className="text-xs text-slate-300">Format</Label>
                <select
                  id="f-type"
                  className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-slate-100 outline-none transition focus:border-xophol-blue focus:ring-2 focus:ring-xophol-blue/30"
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All formats</option>
                  {ENGINE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-status" className="text-xs text-slate-300">Status</Label>
                <select
                  id="f-status"
                  className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-slate-100 outline-none transition focus:border-xophol-blue focus:ring-2 focus:ring-xophol-blue/30"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  {ENGINE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-topic" className="text-xs text-slate-300">Topic</Label>
                <select
                  id="f-topic"
                  className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-slate-100 outline-none transition focus:border-xophol-blue focus:ring-2 focus:ring-xophol-blue/30"
                  value={topicFilter}
                  onChange={(e) => {
                    setTopicFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All topics</option>
                  {(vocab?.topics ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-diff" className="text-xs text-slate-300">Difficulty</Label>
                <select
                  id="f-diff"
                  className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-slate-100 outline-none transition focus:border-xophol-blue focus:ring-2 focus:ring-xophol-blue/30"
                  value={difficultyFilter}
                  onChange={(e) => {
                    setDifficultyFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All levels</option>
                  <option value="1">Level 1 · Easy</option>
                  <option value="2">Level 2 · Medium</option>
                  <option value="3">Level 3 · Advanced</option>
                </select>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Question library</p>
              <p className="mt-1 text-sm text-slate-300">
                {loading ? "Refreshing your question bank…" : `${pagination?.total ?? 0} questions found`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ENGINE_STATUSES.map((status) => {
                const selected = statusFilter === status;
                return (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setStatusFilter(selected ? "" : status);
                      setPage(1);
                    }}
                    className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xophol-orange ${
                      selected
                        ? "border-xophol-orange/50 bg-xophol-orange/10 text-orange-100"
                        : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.07]"
                    }`}
                  >
                    {status}
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${selected ? "bg-xophol-orange/20 text-orange-100" : "bg-white/10 text-slate-300"}`}>
                      {Number(counts[status] ?? 0)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="space-y-3" aria-label="Loading questions">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
            </div>
          ) : loadError ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-950/20 p-6 text-sm text-red-200" role="alert">
              <div className="flex items-start gap-3">
                <CircleHelp className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">The question bank could not be loaded.</p>
                  <p className="mt-1 text-red-100/75">{loadError}</p>
                </div>
              </div>
            </div>
          ) : rows.length === 0 ? (
            <AdminEmpty
              icon={FileQuestion}
              title={search || typeFilter || statusFilter || topicFilter || difficultyFilter ? "No questions match these filters" : "Your question bank is ready to grow"}
              hint={search || typeFilter || statusFilter || topicFilter || difficultyFilter ? "Try widening your search or clearing one or more filters." : "Create your first question or import a prepared CSV bank to get started."}
              action={
                search || typeFilter || statusFilter || topicFilter || difficultyFilter ? (
                  <Button type="button" variant="outline" className="mt-2 gap-2" onClick={resetFilters}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Clear filters
                  </Button>
                ) : (
                  <Button type="button" className="mt-2 gap-2 bg-xophol-orange text-xophol-ink hover:bg-xophol-orange/90" onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Create your first question
                  </Button>
                )
              }
              className="rounded-2xl border border-dashed border-white/15 bg-slate-950/20 py-14"
            />
          ) : (
            <div className="space-y-3">
              {rows.map((q, index) => (
                <QuestionRow
                  key={q.id}
                  row={q}
                  index={(page - 1) * 20 + index + 1}
                  busy={busyId === q.id}
                  onEdit={() => setEditingId(q.id)}
                  onTransition={(to) => transition(q.id, to, "")}
                  onArchive={() => archive(q.id)}
                />
              ))}
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3">
              <span className="text-sm text-slate-400">
                Showing <span className="font-semibold text-white">{(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)}</span> of {pagination.total}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 border-white/10 bg-white/[0.03]" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Previous
                </Button>
                <span className="flex items-center px-2 text-xs text-slate-400">Page {pagination.page} of {pagination.totalPages}</span>
                <Button variant="outline" size="sm" className="gap-1.5 border-white/10 bg-white/[0.03]" disabled={!pagination.hasMore || loading} onClick={() => setPage((p) => p + 1)}>
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="queue" className="mt-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/15 bg-amber-400/[0.06] px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-300/10 text-amber-200">
                <Clock3 className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Review before publishing</p>
                <p className="text-xs text-slate-400">Imported and AI-generated questions remain drafts until approved.</p>
              </div>
            </div>
            <span className="rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-xs font-semibold text-amber-100">
              {Number(counts.draft ?? 0)} awaiting review
            </span>
          </div>
          <ReviewQueue onDone={load} onEdit={setEditingId} />
        </TabsContent>

        <TabsContent value="import" className="mt-0">
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-xophol-blue/25 bg-xophol-blue/10 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-xophol-blue/20 text-blue-200">
              <Upload className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">Bring your question bank with you</p>
              <p className="text-xs leading-5 text-slate-300">Validate and import CSV content in batches. New imports stay in draft for review.</p>
            </div>
          </div>
          <CsvImport onDone={load} />
        </TabsContent>
      </Tabs>
    </AdminPage>
  );
}

/* ------------------------------------------------------------ list row */

function QuestionRow({
  row,
  index,
  busy,
  onEdit,
  onTransition,
  onArchive,
}: {
  row: EngineQuestionRow;
  index: number;
  busy: boolean;
  onEdit: () => void;
  onTransition: (to: EngineStatus) => void;
  onArchive: () => void;
}) {
  const status = (row.engine_status ?? "draft") as EngineStatus;
  const stem = row.stem ?? row.question_text ?? "";
  return (
    <Card className="glass-panel group overflow-hidden rounded-2xl transition duration-200 hover:-translate-y-0.5 hover:border-xophol-blue/35 hover:shadow-xl hover:shadow-slate-950/20">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-xophol-blue/25 bg-xophol-blue/10 text-sm font-bold tabular-nums text-blue-200">
            {String(index).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_BADGE[status]} className="capitalize">{status}</Badge>
              <Badge variant="outline" className="border-white/15 bg-white/[0.03] text-slate-300">{(row.engine_type ?? "mcq").replace(/_/g, " ")}</Badge>
              <Badge variant="outline" className="border-white/15 bg-white/[0.03] text-slate-300">Level {row.difficulty ?? 1}</Badge>
              {row.source === "ai" && <Badge variant="outline" className="border-violet-300/20 bg-violet-300/10 text-violet-200">AI generated</Badge>}
              {row.source === "import" && <Badge variant="outline" className="border-xophol-orange/20 bg-xophol-orange/10 text-orange-100">Imported</Badge>}
              {row.pyq_year ? <Badge variant="outline" className="border-white/15 bg-white/[0.03] text-slate-300">PYQ {row.pyq_year}</Badge> : null}
            </div>
            <p className="line-clamp-2 text-sm font-semibold leading-6 text-white sm:text-base">{stem || "Untitled question"}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
              <span className="capitalize">{row.skill ?? "recall"}</span>
              <span aria-hidden="true" className="text-slate-600">&middot;</span>
              <span>{row.marks ?? 1} marks</span>
              <span aria-hidden="true" className="text-slate-600">&middot;</span>
              <span>{row.est_time_sec ?? 60}s</span>
              <span aria-hidden="true" className="text-slate-600">&middot;</span>
              <span>{row.board_pattern ?? "CBSE"}</span>
              {row.neg_marks ? <><span aria-hidden="true" className="text-slate-600">&middot;</span><span>{row.neg_marks} negative</span></> : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pl-[3.35rem] sm:shrink-0 sm:pl-0">
          <Button size="sm" variant="outline" className="border-white/15 bg-white/[0.03] text-slate-200 hover:bg-white/10 hover:text-white" onClick={onEdit} disabled={busy}>
            Edit
          </Button>
          {status === "draft" && (
            <Button size="sm" className="gap-1.5 bg-xophol-orange font-semibold text-xophol-ink hover:bg-xophol-orange/90" onClick={() => onTransition("reviewed")} disabled={busy}>
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Mark reviewed
            </Button>
          )}
          {status === "reviewed" && (
            <Button size="sm" className="gap-1.5 bg-emerald-600 font-semibold text-white hover:bg-emerald-500" onClick={() => onTransition("published")} disabled={busy}>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              Publish
            </Button>
          )}
          {status === "published" && (
            <Button size="sm" variant="outline" className="border-white/15 bg-white/[0.03] text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => onTransition("retired")} disabled={busy}>
              Retire
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-slate-400 hover:bg-red-500/10 hover:text-red-200" onClick={onArchive} disabled={busy}>
            Archive
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------- review queue */

function ReviewQueue({ onDone, onEdit }: { onDone: () => void; onEdit: (id: string) => void }) {
  const [items, setItems] = useState<EngineQuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/engine/questions?status=draft&limit=50", { cache: "no-store" });
      const json = (await res.json()) as ListResponse;
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load review queue.");
      setItems(questionListPayload(json).data);
    } catch (err) {
      setItems([]);
      toast({
        title: "Review queue failed to load",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/engine/questions?status=draft&limit=50", { cache: "no-store" });
        const json = (await res.json()) as ListResponse;
        if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load review queue.");
        if (!cancelled) setItems(questionListPayload(json).data);
      } catch (err) {
        if (!cancelled) {
          setItems([]);
          toast({
            title: "Review queue failed to load",
            description: err instanceof Error ? err.message : String(err),
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function decide(id: string, to: EngineStatus) {
    try {
      const res = await fetch(`/api/admin/engine/questions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to, reviewNotes: notes[id] ?? "" }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed");
      toast({ title: `Question moved to ${to}` });
      await load();
      onDone();
    } catch (err) {
      toast({
        title: "Review failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }

  if (loading) return <Skeleton className="h-40 w-full" />;
  if (items.length === 0) {
    return (
      <Card className="glass-panel rounded-2xl">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nothing waiting for review. Drafts from CSV import and AI generation land here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {items.length} draft(s) awaiting review. AI and imported content cannot reach students until published.
      </p>
      {items.map((q) => (
        <Card key={q.id} className="glass-panel rounded-2xl">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{q.engine_status ?? "draft"}</Badge>
              <Badge variant="outline">{q.engine_type ?? "mcq"}</Badge>
              <Badge variant="outline">D{q.difficulty ?? 1}</Badge>
              {q.source === "ai" && <Badge>AI generated</Badge>}
              {q.source === "import" && <Badge>Imported</Badge>}
            </div>
            <p className="text-sm">{q.stem ?? q.question_text}</p>
            {q.explanation ? (
              <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">{q.explanation}</p>
            ) : null}
            <Textarea
              rows={2}
              placeholder="Reviewer notes (stored in question_review_history)"
              value={notes[q.id] ?? ""}
              onChange={(e) => setNotes((prev) => ({ ...prev, [q.id]: e.target.value }))}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => decide(q.id, "reviewed")}>
                Approve (reviewed)
              </Button>
              <Button size="sm" variant="outline" onClick={() => decide(q.id, "published")}>
                Publish now
              </Button>
              <Button size="sm" variant="destructive" onClick={() => decide(q.id, "retired")}>
                Reject (retire)
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onEdit(q.id)}>
                Open editor
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* --------------------------------------------------------- csv import */

function CsvImport({ onDone }: { onDone: () => void }) {
  const [csv, setCsv] = useState("");
  const [defaultStatus, setDefaultStatus] = useState<"draft" | "reviewed">("draft");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<number | null>(null);

  async function run() {
    if (!csv.trim()) {
      toast({ title: "Nothing to import", description: "Paste CSV text first.", variant: "destructive" });
      return;
    }
    setBusy(true);
    setCreated(null);
    try {
      const res = await fetch("/api/admin/engine/questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, defaultStatus }),
      });
      const json = (await res.json()) as { success: boolean; data?: { created: number }; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? "Import failed");
      setCreated(json.data?.created ?? 0);
      toast({ title: `Imported ${json.data?.created ?? 0} question(s)` });
      onDone();
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function loadDemo() {
    try {
      const res = await fetch(DEMO_CSV_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("Demo file not found");
      setCsv(await res.text());
      toast({ title: "Demo template loaded", description: "5 sample rows: mcq, assertion_reason, fill_blank, equation, short." });
    } catch (err) {
      toast({
        title: "Demo load failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(csv || CSV_TEMPLATE);
      toast({ title: "Copied", description: "Template CSV copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Select the text and copy manually.", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="glass-panel rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Upload className="h-4 w-4 text-xophol-orange" aria-hidden="true" />
            Paste CSV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Header row required. Options must be a JSON array; answer_json and rubric_json are optional. Validation
            is all-or-nothing: one bad row rejects the whole batch. Max 500 rows.
          </p>
          <Textarea rows={16} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={CSV_TEMPLATE} />
          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="imp-status" className="text-sm">
              Import as
            </Label>
            <select
              id="imp-status"
              className="glass-input rounded-md px-2 py-1 text-sm"
              value={defaultStatus}
              onChange={(e) => setDefaultStatus(e.target.value === "reviewed" ? "reviewed" : "draft")}
            >
              <option value="draft">draft (recommended)</option>
              <option value="reviewed">reviewed</option>
            </select>
            <Button onClick={() => void run()} disabled={busy}>
              {busy ? "Importingâ€¦" : "Run import"}
            </Button>
            {created !== null && <Badge variant="outline">{created} created</Badge>}
          </div>
        </CardContent>
      </Card>
      <Card className="glass-panel rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <FileQuestion className="h-4 w-4 text-blue-300" aria-hidden="true" />
            Demo template — match your sheet to this
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Download this 5-row demo (mcq, assertion_reason, fill_blank, equation, short), open it in Excel, then
            reshape your 200 questions to the same columns. Required: <code>type</code>, <code>stem</code>,{" "}
            <code>topic_slug</code>, <code>difficulty</code>, <code>skill</code>.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={CSV_TEMPLATE_URL} download="questions-import-template.csv">
              <Button variant="outline" type="button">Download blank CSV template</Button>
            </a>
            <a href={DEMO_CSV_URL} download="questions-import-demo.csv">
              <Button variant="outline" type="button">Download demo CSV</Button>
            </a>
            <Button variant="outline" type="button" onClick={() => void loadDemo()}>
              Load demo into editor
            </Button>
            <Button variant="ghost" type="button" onClick={() => void copyTemplate()}>
              Copy
            </Button>
          </div>
          <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs">{CSV_TEMPLATE}</pre>
          <Button variant="outline" onClick={() => setCsv(CSV_TEMPLATE)}>
            Load 1-row template into editor
          </Button>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="p-2">Column</th>
                  <th className="p-2">Required</th>
                  <th className="p-2">Example</th>
                  <th className="p-2">How to match your bank</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_COLUMN_GUIDE.map((c) => (
                  <tr key={c.column} className="border-b last:border-0">
                    <td className="p-2 font-mono font-semibold">{c.column}</td>
                    <td className="p-2">{c.required ? <Badge>required</Badge> : <Badge variant="outline">optional</Badge>}</td>
                    <td className="max-w-[220px] truncate p-2 font-mono" title={c.example}>{c.example}</td>
                    <td className="p-2 text-muted-foreground">{c.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Your old columns map like this: question_text → stem, question_type (MCQ) → type (mcq), option_a..d →
            options JSON array with exactly 1 is_correct:true, correct_option → answer_json correct_option label,
            marks → marks, negative_marks → neg_marks, explanation → explanation. topic_slug must be a real slug
            (e.g. chemical-equations-balancing) — it cannot be blank.
          </p>
        </CardContent>
      </Card>
    </div>
    <Card className="glass-panel rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <BookOpenCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
          Demo rows preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs text-muted-foreground">
        <p>The downloadable demo contains these 5 rows — one per common type. After import they land as draft with an Imported badge in the Review queue.</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li><span className="font-mono">mcq</span> — 4 options, B correct, tags reactions|recall.</li>
          <li><span className="font-mono">assertion_reason</span> — 4 options, A correct.</li>
          <li><span className="font-mono">fill_blank</span> — options holds the accepted blank text (Fe3O4), answer_json.blanks holds variants.</li>
          <li><span className="font-mono">equation</span> — no options; balanced equation in answer_json.</li>
          <li><span className="font-mono">short</span> — model answer in rubric_json + answer_json.value.</li>
        </ol>
      </CardContent>
    </Card>
    </div>
  );
}
