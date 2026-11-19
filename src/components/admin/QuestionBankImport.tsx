"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type CatalogItem = { id: string; name: string; code?: string };
type Batch = {
  id: string;
  status: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
};
type PreviewRow = {
  rowNo: number;
  valid: boolean;
  errors: string[];
  data: { question_text: string; options: Array<{ label: string; body: string; is_correct: boolean }>; difficulty: string };
  duplicate: { existingId: string; similarity: number } | null;
};

const MAPPING_FIELDS: Array<{ key: string; label: string }> = [
  { key: "question", label: "Question" },
  { key: "option_a", label: "Option A" },
  { key: "option_b", label: "Option B" },
  { key: "option_c", label: "Option C" },
  { key: "option_d", label: "Option D" },
  { key: "option_e", label: "Option E" },
  { key: "option_f", label: "Option F" },
  { key: "correct_answer", label: "Correct answer" },
  { key: "explanation", label: "Explanation" },
  { key: "chapter", label: "Chapter" },
  { key: "topic", label: "Topic" },
  { key: "difficulty", label: "Difficulty" },
  { key: "marks", label: "Marks" },
  { key: "negative_marks", label: "Negative marks" },
  { key: "language", label: "Language" },
  { key: "question_type", label: "Question type" },
];

export default function QuestionBankImport() {
  const supabase = useMemo(() => createClient(), []);
  const [boards, setBoards] = useState<CatalogItem[]>([]);
  const [classes, setClasses] = useState<CatalogItem[]>([]);
  const [subjects, setSubjects] = useState<CatalogItem[]>([]);
  const [chapters, setChapters] = useState<CatalogItem[]>([]);
  const [topics, setTopics] = useState<CatalogItem[]>([]);
  const [boardId, setBoardId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [difficulty, setDifficulty] = useState("medium");
  const [status, setStatus] = useState<"draft" | "pending_review">("pending_review");
  const [duplicatePolicy, setDuplicatePolicy] = useState<"skip" | "import_as_new">("skip");
  const [batch, setBatch] = useState<Batch | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase.from("boards").select("id, name, code").eq("is_active", true).order("name");
        if (error) throw error;
        if (active) setBoards(data ?? []);
        await refreshHistory();
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Could not load boards.");
      }
    })();
    return () => { active = false; };
  }, [supabase]);

  useEffect(() => {
    if (!boardId) return;
    void (async () => {
      try {
        const { data, error } = await supabase.from("classes").select("id, name, code").eq("board_id", boardId).eq("is_active", true).order("name");
        if (error) throw error;
        setClasses(data ?? []);
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Could not load classes.");
      }
    })();
  }, [boardId, supabase]);

  useEffect(() => {
    if (!classId) return;
    void (async () => {
      try {
        const { data, error } = await supabase.from("subjects").select("id, name, code").eq("class_id", classId).eq("is_active", true).order("name");
        if (error) throw error;
        setSubjects(data ?? []);
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Could not load subjects.");
      }
    })();
  }, [classId, supabase]);

  useEffect(() => {
    if (!subjectId) return;
    void (async () => {
      try {
        const { data, error } = await supabase.from("chapters").select("id, name, code").eq("subject_id", subjectId).eq("is_active", true).order("name");
        if (error) throw error;
        setChapters(data ?? []);
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Could not load chapters.");
      }
    })();
  }, [subjectId, supabase]);

  useEffect(() => {
    if (!chapterId) return;
    void (async () => {
      try {
        const { data, error } = await supabase.from("topics").select("id, name, code").eq("chapter_id", chapterId).eq("is_active", true).order("name");
        if (error) throw error;
        setTopics(data ?? []);
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "Could not load topics.");
      }
    })();
  }, [chapterId, supabase]);

  async function refreshHistory() {
    const response = await fetch("/api/admin/qbank/import", { cache: "no-store" });
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.error || "Could not load import history.");
    setHistory(json.data.batches ?? []);
  }

  async function uploadAndPreview() {
    if (!file || !boardId || !classId || !subjectId) {
      setMessage("Select a board, class, subject, and file.");
      return;
    }
    setBusy(true);
    setMessage("");
    setBatch(null);
    setPreview([]);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("settings", JSON.stringify({
        board_id: boardId,
        class_id: classId,
        subject_id: subjectId,
        chapter_id: chapterId || null,
        topic_id: topicId || null,
        column_mapping: {},
        default_status: status,
        default_difficulty: difficulty,
        default_language: "en",
        duplicate_policy: duplicatePolicy,
        skip_invalid: true,
      }));
      const response = await fetch("/api/admin/qbank/import", { method: "POST", body: form });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Import preview failed.");
      setBatch(json.data.batch);
      setPreview(json.data.preview ?? []);
      setHeaders(json.data.headers ?? []);
      setMapping(json.data.mapping ?? {});
      setMessage(`Preview ready: ${json.data.batch.valid_rows} valid, ${json.data.batch.invalid_rows} invalid, ${json.data.batch.duplicate_rows} potential duplicates.`);
      await refreshHistory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import preview failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remapBatch() {
    if (!batch) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/qbank/import/${batch.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mapping),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Column mapping failed.");
      setBatch(json.data.batch);
      setPreview(json.data.preview ?? []);
      setMessage(`Mapping validated: ${json.data.batch.valid_rows} valid, ${json.data.batch.invalid_rows} invalid, ${json.data.batch.duplicate_rows} potential duplicates.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Column mapping failed.");
    } finally {
      setBusy(false);
    }
  }

  async function executeBatch() {
    if (!batch) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/qbank/import/${batch.id}`, { method: "POST" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Import failed.");
      setMessage(`Import ${json.data.status}: ${json.data.imported} imported, ${json.data.skipped} skipped, ${json.data.failed} failed.`);
      setBatch({ ...batch, status: json.data.status });
      await refreshHistory();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
      await refreshHistory();
    } finally {
      setBusy(false);
    }
  }

  function selectField(label: string, value: string, onChange: (value: string) => void, items: CatalogItem[], required = false) {
    return (
      <div className="grid gap-2">
        <Label>{label}{required ? " *" : ""}</Label>
        <select className="glass-input rounded-md px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select {label.toLowerCase()}</option>
          {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Bulk question import</CardTitle>
          <CardDescription>Upload a UTF-8 CSV or XLSX file (maximum 10 MB and 5,000 rows). Imports are staged for review before execution.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {selectField("Board", boardId, (value) => {
              setBoardId(value);
              setClassId("");
              setSubjectId("");
              setChapterId("");
              setTopicId("");
            }, boards, true)}
            {selectField("Class", classId, (value) => {
              setClassId(value);
              setSubjectId("");
              setChapterId("");
              setTopicId("");
            }, classes, true)}
            {selectField("Subject", subjectId, (value) => {
              setSubjectId(value);
              setChapterId("");
              setTopicId("");
            }, subjects, true)}
            {selectField("Default chapter", chapterId, (value) => {
              setChapterId(value);
              setTopicId("");
            }, chapters)}
            {selectField("Default topic", topicId, setTopicId, topics)}
            <div className="grid gap-2">
              <Label htmlFor="default-difficulty">Default difficulty</Label>
              <select id="default-difficulty" className="glass-input rounded-md px-3 py-2" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="question-status">Initial status</Label>
              <select id="question-status" className="glass-input rounded-md px-3 py-2" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
                <option value="pending_review">Pending review</option><option value="draft">Draft</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="duplicate-policy">Duplicate policy</Label>
              <select id="duplicate-policy" className="glass-input rounded-md px-3 py-2" value={duplicatePolicy} onChange={(event) => setDuplicatePolicy(event.target.value as typeof duplicatePolicy)}>
                <option value="skip">Skip potential duplicates</option><option value="import_as_new">Import separately</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="question-file">CSV or XLSX file</Label>
              <Input id="question-file" type="file" accept=".csv,.xlsx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={uploadAndPreview} disabled={busy}>{busy ? "Working..." : "Validate and preview"}</Button>
            {batch?.status === "validated" && <Button variant="outline" onClick={executeBatch} disabled={busy}>Import validated rows</Button>}
            {["single_correct", "multiple_correct", "true_false", "fill_blank", "match_following", "numerical"].map((type) => (
              <Link key={type} className="text-sm underline underline-offset-4" href={`/api/admin/qbank/templates/${type}`}>
                {type.replace(/_/g, " ")} template
              </Link>
            ))}
          </div>
          {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Preview (first {preview.length} rows)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {MAPPING_FIELDS.map((field) => (
                <div key={field.key} className="grid gap-1">
                  <Label htmlFor={`mapping-${field.key}`}>{field.label}</Label>
                  <select
                    id={`mapping-${field.key}`}
                    className="glass-input rounded-md px-3 py-2"
                    value={mapping[field.key] ?? ""}
                    onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))}
                  >
                    <option value="">Not mapped</option>
                    {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={remapBatch} disabled={busy}>Apply column mapping</Button>
            {batch && (batch.invalid_rows > 0 || batch.duplicate_rows > 0) && (
              <Button variant="outline" asChild>
                <a href={`/api/admin/qbank/import/${batch.id}?format=errors`}>Download validation report</a>
              </Button>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead><tr><th className="p-2">Row</th><th className="p-2">Question</th><th className="p-2">Options / answer</th><th className="p-2">Result</th></tr></thead>
                <tbody>
                  {preview.map((row) => (
                    <tr key={row.rowNo} className="border-t">
                      <td className="p-2">{row.rowNo}</td>
                      <td className="max-w-md p-2">{row.data.question_text}</td>
                      <td className="p-2">{row.data.options.map((option) => `${option.label}. ${option.body}${option.is_correct ? " ✓" : ""}`).join(" · ")}</td>
                      <td className="p-2">{row.errors.length ? row.errors.join("; ") : row.duplicate ? `Possible duplicate (${Math.round(row.duplicate.similarity * 100)}%)` : "Ready"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {batch && <p className="text-xs text-muted-foreground">Batch ID: {batch.id}. Review the validation summary before starting the import.</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Recent import history</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead><tr><th className="p-2">File</th><th className="p-2">Status</th><th className="p-2">Rows</th><th className="p-2">Date</th></tr></thead>
            <tbody>{history.map((item) => (
              <tr key={String(item.id)} className="border-t">
                <td className="p-2">{String(item.filename ?? "")}</td>
                <td className="p-2">{String(item.status ?? "")}</td>
                <td className="p-2">{String(item.imported_rows ?? 0)} / {String(item.total_rows ?? 0)}</td>
                <td className="p-2">{String(item.created_at ?? "")}</td>
              </tr>
            ))}</tbody>
          </table>
          {history.length === 0 && <p className="py-4 text-sm text-muted-foreground">No import batches yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
