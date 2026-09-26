"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { CreateEngineQuestionInput, EngineOptionInput } from "@/lib/engine/question-schema";
import type { EngineStatus } from "@/lib/engine/vocab";
import { ENGINE_BOARDS, ENGINE_SKILLS, ENGINE_SOURCES, ENGINE_TYPES } from "@/lib/engine/vocab";

/* ------------------------------------------------------------------ types */

export type EngineQuestionRow = {
  id: string;
  engine_type: string | null;
  stem: string | null;
  question_text: string | null;
  engine_status: EngineStatus | null;
  topic_id: string | null;
  subtopic_id: string | null;
  parent_id: string | null;
  difficulty: 1 | 2 | 3 | null;
  skill: string | null;
  marks: number | null;
  neg_marks: number | null;
  est_time_sec: number | null;
  board_pattern: string | null;
  pyq_year: number | null;
  lang: string | null;
  source: string | null;
  explanation: string | null;
  tags: string[] | null;
  question_options?: EngineOptionRow[] | null;
  question_answers?: EngineAnswerRow[] | null;
  question_tags?: Array<{ tag: string }> | null;
  question_stats?: EngineStatsRow[] | null;
};

export type EngineOptionRow = {
  id?: string;
  label?: string | null;
  body?: string | null;
  option_text?: string | null;
  is_correct?: boolean | null;
  position?: number | null;
  sort_order?: number | null;
};

type EngineAnswerRow = { answer_json: unknown; rubric_json: unknown; explanation: string | null };
type EngineStatsRow = { attempts: number | null; correct_count: number | null; correct_rate: number | null; avg_time: number | null };

type VocabTopic = {
  id: string;
  name: string;
  code: string;
  chapters: { id: string; name: string; subjects: { id: string; name: string } | null } | null;
};

type VocabSubtopic = { id: string; name: string; code: string; topic_id: string };

export type EngineVocab = {
  topics: VocabTopic[];
  subtopics: VocabSubtopic[];
  types: readonly string[];
  statuses: readonly string[];
  reviewCounts: Record<string, number>;
};

type EditableOption = { label: string; body: string; is_correct: boolean };

/** Types that present an option list to the student. */
export const OPTION_TYPES = new Set([
  "mcq",
  "assertion_reason",
  "statement",
  "match",
  "fill_blank",
  "equation",
]);

/* ---------------------------------------------------------------- helpers */

export function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function toEditableOptions(row: EngineQuestionRow | null): EditableOption[] {
  const rows = row?.question_options ?? [];
  if (rows.length) {
    return rows.map((o, i) => ({
      label: o.label ?? String.fromCharCode(65 + i),
      body: o.body ?? o.option_text ?? "",
      is_correct: Boolean(o.is_correct),
    }));
  }
  return [
    { label: "A", body: "", is_correct: true },
    { label: "B", body: "", is_correct: false },
    { label: "C", body: "", is_correct: false },
    { label: "D", body: "", is_correct: false },
  ];
}

function topicPath(t: VocabTopic): string {
  const subject = t.chapters?.subjects?.name;
  const chapter = t.chapters?.name;
  return [subject, chapter, t.name].filter(Boolean).join(" > ");
}

/** Engine option input -> the persisted option shape. */
export function toEngineOptionInput(options: EditableOption[]): EngineOptionInput[] {
  return options
    .filter((o) => o.body.trim().length > 0)
    .map((o, i) => ({
      label: o.label || String.fromCharCode(65 + i),
      body: o.body.trim(),
      is_correct: o.is_correct,
      position: i + 1,
    }));
}

/* --------------------------------------------------------------- component */


export default function EngineQuestionEditor({
  questionId,
  onSaved,
  onCancel,
}: {
  questionId?: string;
  onSaved?: (row: EngineQuestionRow) => void;
  onCancel?: () => void;
}) {
  const [vocab, setVocab] = useState<EngineVocab | null>(null);
  const [existing, setExisting] = useState<EngineQuestionRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(questionId));

  const [type, setType] = useState<string>("mcq");
  const [stem, setStem] = useState("");
  const [topicId, setTopicId] = useState("");
  const [subtopicId, setSubtopicId] = useState("");
  const [parentId, setParentId] = useState("");
  const [difficulty, setDifficulty] = useState<"1" | "2" | "3">("1");
  const [skill, setSkill] = useState<string>("recall");
  const [marks, setMarks] = useState("1");
  const [negMarks, setNegMarks] = useState("0");
  const [estTimeSec, setEstTimeSec] = useState("60");
  const [boardPattern, setBoardPattern] = useState<string>("CBSE");
  const [pyqYear, setPyqYear] = useState("");
  const [status, setStatus] = useState<EngineStatus>("draft");
  const [source, setSource] = useState<string>("manual");
  const [tags, setTags] = useState("");
  const [explanation, setExplanation] = useState("");
  const [options, setOptions] = useState<EditableOption[]>(toEditableOptions(null));
  const [assertion, setAssertion] = useState("");
  const [reason, setReason] = useState("");
  const [modelAnswer, setModelAnswer] = useState("");
  const [rubricPoints, setRubricPoints] = useState("");

  const subtopicsForTopic = useMemo(
    () => (vocab?.subtopics ?? []).filter((s) => s.topic_id === topicId),
    [vocab, topicId]
  );

  const setOption = useCallback((idx: number, patch: Partial<EditableOption>) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  }, []);

  /** Single-correct types must have exactly one tick, so selecting one clears the rest. */
  const toggleCorrect = useCallback(
    (idx: number) => {
      const single = type === "mcq" || type === "assertion_reason" || type === "statement";
      setOptions((prev) =>
        prev.map((o, i) => ({ ...o, is_correct: single ? i === idx : i === idx ? !o.is_correct : o.is_correct }))
      );
    },
    [type]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/engine/vocab", { cache: "no-store" });
        const json = (await res.json()) as { success: boolean; data?: EngineVocab };
        if (!cancelled && res.ok && json.success && json.data) setVocab(json.data);
        if (!questionId) return;
        const qres = await fetch(`/api/admin/engine/questions/${questionId}`, { cache: "no-store" });
        const qjson = (await qres.json()) as { success: boolean; data?: EngineQuestionRow };
        if (cancelled) return;
        if (!qres.ok || !qjson.success || !qjson.data) {
          toast({ title: "Load failed", description: "Could not load the question.", variant: "destructive" });
          return;
        }
        const q = qjson.data;
        setExisting(q);
        setType(q.engine_type ?? "mcq");
        setStem(q.stem ?? q.question_text ?? "");
        setTopicId(q.topic_id ?? "");
        setSubtopicId(q.subtopic_id ?? "");
        setParentId(q.parent_id ?? "");
        setDifficulty(String(q.difficulty ?? 1) as "1" | "2" | "3");
        setSkill(q.skill ?? "recall");
        setMarks(String(q.marks ?? 1));
        setNegMarks(String(q.neg_marks ?? 0));
        setEstTimeSec(String(q.est_time_sec ?? 60));
        setBoardPattern(q.board_pattern ?? "CBSE");
        setPyqYear(q.pyq_year ? String(q.pyq_year) : "");
        setStatus((q.engine_status ?? "draft") as EngineStatus);
        setSource(q.source ?? "manual");
        const tagList = q.tags ?? (q.question_tags ?? []).map((t) => t.tag);
        setTags(tagList.join("|"));
        const answers = q.question_answers?.[0];
        setExplanation(answers?.explanation ?? q.explanation ?? "");
        setOptions(toEditableOptions(q));
        const answer = parseJsonObject(answers?.answer_json);
        const rubric = parseJsonObject(answers?.rubric_json);
        if (typeof answer.assertion === "string") setAssertion(answer.assertion);
        if (typeof answer.reason === "string") setReason(answer.reason);
        const model = typeof answer.value === "string" ? answer.value : rubric.model_answer;
        if (typeof model === "string") setModelAnswer(model);
        const criteria = Array.isArray(rubric.criteria) ? rubric.criteria : [];
        setRubricPoints(
          criteria
            .map((c) => {
              const row = (c ?? {}) as { point?: string; marks?: number };
              return `${row.point ?? ""} (${row.marks ?? 0})`;
            })
            .join("\n")
        );
      } catch (err) {
        if (!cancelled) {
          toast({
            title: "Load failed",
            description: err instanceof Error ? err.message : String(err),
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);



  function buildPayload(): CreateEngineQuestionInput {
    const optInput = OPTION_TYPES.has(type) ? toEngineOptionInput(options) : [];

    const answer: Record<string, unknown> = {};
    if (type === "assertion_reason") {
      answer.assertion = assertion.trim();
      answer.reason = reason.trim();
    }
    if (type === "equation") {
      answer.balanced_equation = options.find((o) => o.is_correct)?.body?.trim() ?? "";
    }
    if (type === "short" || type === "long") answer.value = modelAnswer.trim();

    const rubric: Record<string, unknown> = {};
    if (modelAnswer.trim()) rubric.model_answer = modelAnswer.trim();
    const criteria = rubricPoints
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = /^(.*?)\s*\((\d+(?:\.\d+)?)\)$/.exec(line);
        return { point: (match?.[1] ?? line).trim(), marks: Number(match?.[2] ?? 0) };
      });
    if (criteria.length) rubric.criteria = criteria;

    return {
      type: type as CreateEngineQuestionInput["type"],
      stem: stem.trim(),
      topicId,
      subtopicId: subtopicId || null,
      parentId: parentId || null,
      difficulty: Number(difficulty) as 1 | 2 | 3,
      skill: skill as CreateEngineQuestionInput["skill"],
      marks: Number(marks),
      negMarks: Number(negMarks),
      estTimeSec: Number(estTimeSec),
      boardPattern: boardPattern as CreateEngineQuestionInput["boardPattern"],
      pyqYear: pyqYear ? Number(pyqYear) : null,
      lang: "en",
      status,
      source: source as CreateEngineQuestionInput["source"],
      tags: tags.split("|").map((t) => t.trim()).filter(Boolean),
      options: optInput,
      answer: answer as CreateEngineQuestionInput["answer"],
      rubric: rubric as CreateEngineQuestionInput["rubric"],
      explanation: explanation.trim(),
      assertion: type === "assertion_reason" ? { assertion: assertion.trim(), reason: reason.trim() } : undefined,
    };
  }

  async function save() {
    setSaving(true);
    try {
      const payload = buildPayload();
      const res = await fetch(
        questionId ? `/api/admin/engine/questions/${questionId}` : "/api/admin/engine/questions",
        {
          method: questionId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = (await res.json()) as {
        success: boolean;
        data?: { question?: EngineQuestionRow };
        error?: string;
      };
      if (!res.ok || !json.success) {
        toast({
          title: "Save failed",
          description: json.error ?? "Please check the fields and retry.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: questionId ? "Question updated" : "Question created",
        description: `Status: ${payload.status}`,
      });
      if (json.data?.question) onSaved?.(json.data.question);
      else if (existing) onSaved?.(existing);
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Loading question…</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{questionId ? "Edit question" : "New question"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="eq-type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="eq-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENGINE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-topic">Topic</Label>
            <Select
              value={topicId}
              onValueChange={(v) => {
                setTopicId(v);
                setSubtopicId("");
              }}
            >
              <SelectTrigger id="eq-topic">
                <SelectValue placeholder="Select a topic" />
              </SelectTrigger>
              <SelectContent>
                {(vocab?.topics ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {topicPath(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="eq-stem">Stem</Label>
          <Textarea
            id="eq-stem"
            rows={5}
            value={stem}
            onChange={(e) => setStem(e.target.value)}
            placeholder="Markdown + KaTeX supported, e.g. Balance: Fe + H2O -> Fe2O3 + H2"
          />
        </div>

        {type === "assertion_reason" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="eq-assertion">Assertion</Label>
              <Textarea id="eq-assertion" rows={2} value={assertion} onChange={(e) => setAssertion(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-reason">Reason</Label>
              <Textarea id="eq-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
        )}

        {OPTION_TYPES.has(type) && (
          <div className="space-y-2">
            <Label>Options</Label>
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type={type === "statement" || type === "fill_blank" ? "checkbox" : "radio"}
                  className="h-4 w-4"
                  checked={o.is_correct}
                  onChange={() => toggleCorrect(i)}
                  aria-label={`Mark option ${o.label} correct`}
                />
                <span className="w-5 text-sm font-medium text-muted-foreground">{o.label}</span>
                <Input
                  value={o.body}
                  onChange={(e) => setOption(i, { body: e.target.value })}
                  placeholder={type === "equation" ? "Balanced equation (tick the correct one)" : "Option text"}
                />
                {options.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setOptions((prev) => prev.filter((_, x) => x !== i))}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
            {options.length < 6 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setOptions((prev) => [
                    ...prev,
                    { label: String.fromCharCode(65 + prev.length), body: "", is_correct: false },
                  ])
                }
              >
                Add option
              </Button>
            )}
          </div>
        )}

        {(type === "short" || type === "long") && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="eq-model">Model answer</Label>
              <Textarea id="eq-model" rows={3} value={modelAnswer} onChange={(e) => setModelAnswer(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-rubric">Rubric — one criterion per line as `point (marks)`</Label>
              <Textarea
                id="eq-rubric"
                rows={3}
                value={rubricPoints}
                onChange={(e) => setRubricPoints(e.target.value)}
                placeholder={"Identifies the redox pair (1)"}
              />
            </div>
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="eq-diff">Difficulty</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as "1" | "2" | "3")}>
              <SelectTrigger id="eq-diff">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 — Easy</SelectItem>
                <SelectItem value="2">2 — Medium</SelectItem>
                <SelectItem value="3">3 — Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-skill">Skill</Label>
            <Select value={skill} onValueChange={setSkill}>
              <SelectTrigger id="eq-skill">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENGINE_SKILLS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-board">Board</Label>
            <Select value={boardPattern} onValueChange={setBoardPattern}>
              <SelectTrigger id="eq-board">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENGINE_BOARDS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="eq-marks">Marks</Label>
            <Input id="eq-marks" type="number" min={0} value={marks} onChange={(e) => setMarks(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-neg">Neg. marks</Label>
            <Input id="eq-neg" type="number" min={0} value={negMarks} onChange={(e) => setNegMarks(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-time">Est. seconds</Label>
            <Input id="eq-time" type="number" min={5} value={estTimeSec} onChange={(e) => setEstTimeSec(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-puq">PYQ year</Label>
            <Input
              id="eq-puq"
              type="number"
              min={1990}
              value={pyqYear}
              onChange={(e) => setPyqYear(e.target.value)}
              placeholder="—"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="eq-status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as EngineStatus)}>
              <SelectTrigger id="eq-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(vocab?.statuses ?? ["draft", "reviewed", "published", "retired"]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-source">Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger id="eq-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENGINE_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-subtopic">Subtopic</Label>
            <Select value={subtopicId} onValueChange={setSubtopicId} disabled={!subtopicsForTopic.length}>
              <SelectTrigger id="eq-subtopic">
                <SelectValue placeholder={subtopicsForTopic.length ? "Optional" : "None"} />
              </SelectTrigger>
              <SelectContent>
                {subtopicsForTopic.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="eq-parent">Parent (case-based grouping)</Label>
          <Input
            id="eq-parent"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            placeholder="Question UUID of the case-study parent (optional)"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="eq-tags">Tags — pipe separated</Label>
          <Input id="eq-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="balancing|pyq|cbse-2023" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="eq-expl">Explanation</Label>
          <Textarea id="eq-expl" rows={3} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
          <p className="text-xs text-muted-foreground">Only shown to students after the attempt is submitted.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void save()} disabled={saving || !stem.trim() || !topicId}>
            {saving ? "Saving…" : questionId ? "Save changes" : "Create question"}
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          {type === "case_based" && <Badge variant="secondary">Case children link via the parent field</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}
