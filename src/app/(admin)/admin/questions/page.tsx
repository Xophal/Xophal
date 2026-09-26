"use client";

import { useCallback, useEffect, useState } from "react";
import EngineQuestionEditor, {
  type EngineQuestionRow,
  type EngineVocab,
} from "@/components/admin/EngineQuestionEditor";
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
type ListResponse = { data: EngineQuestionRow[]; pagination: Pagination };

const STATUS_BADGE: Record<EngineStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  reviewed: "outline",
  published: "default",
  retired: "destructive",
};

const CSV_TEMPLATE = [
  "type,stem,topic_slug,difficulty,skill,marks,neg_marks,est_time_sec,board_pattern,tags,options,answer_json,rubric_json,explanation",
  'mcq,"Which gas turns limewater milky?",corrosion-and-rancidity,1,recall,1,0.25,60,CBSE,"reactions|recall",',
  '"[ {""label"":""A"",""body"":""Oxygen"",""is_correct"":false},{""label"":""B"",""body"":""Carbon dioxide"",""is_correct"":true},{""label"":""C"",""body"":""Hydrogen"",""is_correct"":false} ]",',
  '"{""correct_option"":""B""}","", "Carbon dioxide reacts with limewater to form calcium carbonate."',
].join("\n");

export default function EngineQuestionsPage() {
  const [vocab, setVocab] = useState<EngineVocab | null>(null);
  const [rows, setRows] = useState<EngineQuestionRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/engine/vocab", { cache: "no-store" });
        const json = (await res.json()) as { success: boolean; data?: EngineVocab };
        if (res.ok && json.success && json.data) setVocab(json.data);
      } catch {
        toast({
          title: "Vocab load failed",
          description: "Topic dropdowns are unavailable.",
          variant: "destructive",
        });
      }
    })();
  }, []);


  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (typeFilter) params.set("type", typeFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (topicFilter) params.set("topicId", topicFilter);
      if (difficultyFilter) params.set("difficulty", difficultyFilter);
      const res = await fetch(`/api/admin/engine/questions?${params.toString()}`, { cache: "no-store" });
      const json = (await res.json()) as ListResponse & { success: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load questions");
      setRows(json.data ?? []);
      setPagination(json.pagination ?? null);
    } catch (err) {
      toast({
        title: "Load failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, statusFilter, topicFilter, difficultyFilter]);

  useEffect(() => {
    void load();
  }, [load]);

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
      const res = await fetch(`/api/admin/engine/questions/${id}/status`, {
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

  const counts = vocab?.reviewCounts ?? {};

  if (editingId || creating) {
    return (
      <div className="p-6">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => {
            setEditingId(null);
            setCreating(false);
          }}
        >
          Back to list
        </Button>
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
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Question bank</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All {ENGINE_TYPES.length} engine question types. Imported and AI-generated content stays in draft until
            a reviewer publishes it.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>New question</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {ENGINE_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === s ? "" : s);
              setPage(1);
            }}
          >
            <Badge variant={statusFilter === s ? "default" : STATUS_BADGE[s]} className="cursor-pointer px-3 py-1">
              {s}: {Number(counts[s] ?? 0)}
            </Badge>
          </button>
        ))}
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Browse</TabsTrigger>
          <TabsTrigger value="queue">Review queue</TabsTrigger>
          <TabsTrigger value="import">CSV import</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
              <div className="space-y-1.5 lg:col-span-2">
                <Label htmlFor="f-search">Search stem</Label>
                <Input
                  id="f-search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="keyword"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-type">Type</Label>
                <select
                  id="f-type"
                  className="glass-input w-full rounded-md px-2 py-2 text-sm"
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All</option>
                  {ENGINE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-status">Status</Label>
                <select
                  id="f-status"
                  className="glass-input w-full rounded-md px-2 py-2 text-sm"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All</option>
                  {ENGINE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-topic">Topic</Label>
                <select
                  id="f-topic"
                  className="glass-input w-full rounded-md px-2 py-2 text-sm"
                  value={topicFilter}
                  onChange={(e) => {
                    setTopicFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All</option>
                  {(vocab?.topics ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-diff">Difficulty</Label>
                <select
                  id="f-diff"
                  className="glass-input w-full rounded-md px-2 py-2 text-sm"
                  value={difficultyFilter}
                  onChange={(e) => {
                    setDifficultyFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={resetFilters}>
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No questions match these filters.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {rows.map((q) => (
                <QuestionRow
                  key={q.id}
                  row={q}
                  busy={busyId === q.id}
                  onEdit={() => setEditingId(q.id)}
                  onTransition={(to) => transition(q.id, to, "")}
                  onArchive={() => archive(q.id)}
                />
              ))}
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasMore}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="queue">
          <ReviewQueue onDone={load} onEdit={setEditingId} />
        </TabsContent>

        <TabsContent value="import">
          <CsvImport onDone={load} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------ list row */

function QuestionRow({
  row,
  busy,
  onEdit,
  onTransition,
  onArchive,
}: {
  row: EngineQuestionRow;
  busy: boolean;
  onEdit: () => void;
  onTransition: (to: EngineStatus) => void;
  onArchive: () => void;
}) {
  const status = (row.engine_status ?? "draft") as EngineStatus;
  const stem = row.stem ?? row.question_text ?? "";
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_BADGE[status]}>{status}</Badge>
            <Badge variant="outline">{row.engine_type ?? "mcq"}</Badge>
            <Badge variant="outline">D{row.difficulty ?? 1}</Badge>
            {row.source === "ai" && <Badge variant="outline">AI</Badge>}
            {row.source === "import" && <Badge variant="outline">import</Badge>}
            {row.pyq_year ? <Badge variant="outline">PYQ {row.pyq_year}</Badge> : null}
          </div>
          <p className="line-clamp-2 text-sm font-medium">{stem}</p>
          <p className="text-xs text-muted-foreground">
            {row.skill ?? "recall"} &middot; {row.marks ?? 1} marks &middot; {row.neg_marks ?? 0} neg &middot;{" "}
            {row.est_time_sec ?? 60}s &middot; {row.board_pattern ?? "CBSE"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onEdit} disabled={busy}>
            Edit
          </Button>
          {status === "draft" && (
            <Button size="sm" onClick={() => onTransition("reviewed")} disabled={busy}>
              Mark reviewed
            </Button>
          )}
          {status === "reviewed" && (
            <Button size="sm" onClick={() => onTransition("published")} disabled={busy}>
              Publish
            </Button>
          )}
          {status === "published" && (
            <Button size="sm" variant="outline" onClick={() => onTransition("retired")} disabled={busy}>
              Retire
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={onArchive} disabled={busy}>
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/engine/questions?status=draft&limit=50", { cache: "no-store" });
      const json = (await res.json()) as ListResponse & { success: boolean };
      setItems(json.success ? (json.data ?? []) : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, to: EngineStatus) {
    try {
      const res = await fetch(`/api/admin/engine/questions/${id}/status`, {
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
      <Card>
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
        <Card key={q.id}>
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

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Paste CSV</CardTitle>
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
      <Card>
        <CardHeader>
          <CardTitle>Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Required: <code>type</code>, <code>stem</code>, <code>topic_slug</code>, <code>difficulty</code>,{" "}
            <code>skill</code>.
          </p>
          <p className="text-muted-foreground">
            Optional: <code>subtopic_slug</code>, <code>marks</code>, <code>neg_marks</code>,{" "}
            <code>est_time_sec</code>, <code>board_pattern</code>, <code>tags</code> (pipe separated),{" "}
            <code>options</code>, <code>answer_json</code>, <code>rubric_json</code>, <code>explanation</code>.
          </p>
          <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs">{CSV_TEMPLATE}</pre>
          <Button variant="outline" onClick={() => setCsv(CSV_TEMPLATE)}>
            Load template into editor
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
