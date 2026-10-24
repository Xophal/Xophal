"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type TaxonomyRow = { id: string; name: string; is_active?: boolean };
type MockTest = {
  id: string;
  title: string;
  slug: string;
  duration_minutes: number;
  total_questions?: number;
  total_marks?: number;
  is_published: boolean;
  is_premium: boolean;
  is_active: boolean;
};
type TestSection = { id: string; name: string; duration_minutes: number | null };
type BankQuestion = {
  id: string;
  stem: string | null;
  question_text: string | null;
  engine_type: string | null;
  marks: number | null;
  negative_marks: number | null;
  time_seconds: number | null;
  est_time_sec: number | null;
  question_type?: { code?: string | null; name?: string | null } | null;
  question_options?: Array<{ id: string; label: string | null; body: string | null; option_text: string | null; is_correct: boolean }>;
};

type ScopeType = "topic_test" | "chapter_test" | "subject_test" | "full_mock";
type TestForm = {
  title: string;
  slug: string;
  scopeType: ScopeType;
  boardId: string;
  classId: string;
  subjectId: string;
  chapterId: string;
  topicId: string;
  description: string;
  durationOverride: string;
  marksOverride: string;
  isPublished: boolean;
  isPremium: boolean;
};

const EMPTY_FORM: TestForm = {
  title: "",
  slug: "",
  scopeType: "chapter_test",
  boardId: "",
  classId: "",
  subjectId: "",
  chapterId: "",
  topicId: "",
  description: "",
  durationOverride: "",
  marksOverride: "",
  isPublished: true,
  isPremium: false,
};

async function getData<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error || "Could not load data.");
  return result.data as T;
}

function makeSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function AdminMockTestsPage() {
  const [tests, setTests] = useState<MockTest[]>([]);
  const [boards, setBoards] = useState<TaxonomyRow[]>([]);
  const [classes, setClasses] = useState<TaxonomyRow[]>([]);
  const [subjects, setSubjects] = useState<TaxonomyRow[]>([]);
  const [chapters, setChapters] = useState<TaxonomyRow[]>([]);
  const [topics, setTopics] = useState<TaxonomyRow[]>([]);
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Record<string, BankQuestion>>({});
  const [form, setForm] = useState<TestForm>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [loadedQuestionScope, setLoadedQuestionScope] = useState("");
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sectionTestId, setSectionTestId] = useState<string | null>(null);
  const [sections, setSections] = useState<TestSection[]>([]);
  const [sectionName, setSectionName] = useState("");
  const [sectionDuration, setSectionDuration] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const needsChapter = form.scopeType === "chapter_test" || form.scopeType === "topic_test";
  const needsTopic = form.scopeType === "topic_test";
  const searchTerm = search.trim();
  const questionScopeKey = JSON.stringify([
    form.boardId,
    form.classId,
    form.subjectId,
    needsChapter ? form.chapterId : "",
    needsTopic ? form.topicId : "",
    searchTerm,
  ]);
  const hasQuestionScope =
    !!form.boardId &&
    !!form.classId &&
    !!form.subjectId &&
    (!needsChapter || !!form.chapterId) &&
    (!needsTopic || !!form.topicId);
  const loadingQuestions = hasQuestionScope && loadedQuestionScope !== questionScopeKey;

  const loadTests = useCallback(async () => {
    try {
      setTests(await getData<MockTest[]>("/api/admin/mock-tests"));
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      await loadTests();
    };
    void initialize();
    void getData<TaxonomyRow[]>("/api/admin/boards")
      .then((rows) => setBoards(rows.filter((row) => row.is_active !== false)))
      .catch((error) => toast({
        title: "Boards could not be loaded",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      }));
  }, [loadTests]);

  useEffect(() => {
    if (!form.boardId || !form.classId || !form.subjectId || (needsChapter && !form.chapterId) || (needsTopic && !form.topicId)) {
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      boardId: form.boardId,
      classId: form.classId,
      subjectId: form.subjectId,
    });
    if (needsChapter) params.set("chapterId", form.chapterId);
    if (needsTopic) params.set("topicId", form.topicId);
    if (searchTerm) params.set("search", searchTerm);

    void fetch(`/api/admin/mock-tests/questions?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "Could not load matching questions.");
        setQuestions(result.data ?? []);
        setQuestionError(null);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setQuestionError(error instanceof Error ? error.message : String(error));
        setQuestions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedQuestionScope(questionScopeKey);
      });
    return () => controller.abort();
  }, [form.boardId, form.classId, form.subjectId, needsChapter, needsTopic, form.chapterId, form.topicId, searchTerm, questionScopeKey]);

  const selectedRows = useMemo(() => Object.values(selectedQuestions), [selectedQuestions]);
  const calculatedSeconds = selectedRows.reduce(
    (sum, question) => sum + Number(question.est_time_sec ?? question.time_seconds ?? 60),
    0
  );
  const calculatedDuration = Math.max(1, Math.ceil(calculatedSeconds / 60));
  const calculatedMarks = Math.round(selectedRows.reduce((sum, question) => sum + Number(question.marks ?? 0), 0) * 100) / 100;
  const durationForDisplay = form.durationOverride ? Number(form.durationOverride) : calculatedDuration;
  const marksForDisplay = form.marksOverride ? Number(form.marksOverride) : calculatedMarks;

  async function selectBoard(boardId: string) {
    setForm((current) => ({ ...current, boardId, classId: "", subjectId: "", chapterId: "", topicId: "" }));
    setClasses([]);
    setSubjects([]);
    setChapters([]);
    setTopics([]);
    setSelectedQuestions({});
    if (!boardId) return;
    try {
      const rows = await getData<Array<TaxonomyRow & { is_active?: boolean }>>(`/api/admin/classes?boardId=${boardId}`);
      setClasses(rows.filter((row) => row.is_active !== false));
    } catch (error) {
      toast({ title: "Classes could not be loaded", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  }

  async function selectClass(classId: string) {
    setForm((current) => ({ ...current, classId, subjectId: "", chapterId: "", topicId: "" }));
    setSubjects([]);
    setChapters([]);
    setTopics([]);
    setSelectedQuestions({});
    if (!classId) return;
    try {
      const rows = await getData<Array<TaxonomyRow & { is_active?: boolean }>>(`/api/admin/subjects?classId=${classId}`);
      setSubjects(rows.filter((row) => row.is_active !== false));
    } catch (error) {
      toast({ title: "Subjects could not be loaded", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  }

  async function selectSubject(subjectId: string) {
    setForm((current) => ({ ...current, subjectId, chapterId: "", topicId: "" }));
    setChapters([]);
    setTopics([]);
    setSelectedQuestions({});
    if (!subjectId) return;
    try {
      const rows = await getData<Array<TaxonomyRow & { is_active?: boolean }>>(`/api/admin/chapters?subjectId=${subjectId}`);
      setChapters(rows.filter((row) => row.is_active !== false));
    } catch (error) {
      toast({ title: "Chapters could not be loaded", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  }

  async function selectChapter(chapterId: string) {
    setForm((current) => ({ ...current, chapterId, topicId: "" }));
    setTopics([]);
    setSelectedQuestions({});
    if (!chapterId) return;
    try {
      const rows = await getData<Array<TaxonomyRow & { is_active?: boolean }>>(`/api/admin/topics?chapterId=${chapterId}`);
      setTopics(rows.filter((row) => row.is_active !== false));
    } catch (error) {
      toast({ title: "Topics could not be loaded", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  }

  function changeScope(scopeType: ScopeType) {
    setForm((current) => ({ ...current, scopeType, chapterId: "", topicId: "" }));
    setTopics([]);
    setSelectedQuestions({});
  }

  function toggleQuestion(question: BankQuestion) {
    setSelectedQuestions((current) => {
      if (current[question.id]) {
        const next = { ...current };
        delete next[question.id];
        return next;
      }
      return { ...current, [question.id]: question };
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        slug: form.slug.trim() || makeSlug(form.title),
        description: form.description,
        scope_type: form.scopeType,
        board_id: form.boardId,
        class_id: form.classId,
        subject_id: form.subjectId,
        chapter_id: form.chapterId || null,
        topic_id: form.topicId || null,
        question_ids: selectedRows.map((question) => question.id),
        duration_minutes: calculatedDuration,
        ...(form.durationOverride ? { duration_minutes_override: Number(form.durationOverride) } : {}),
        ...(form.marksOverride !== "" ? { total_marks_override: Number(form.marksOverride) } : {}),
        passing_marks: 0,
        negative_marking: selectedRows.some((question) => Number(question.negative_marks ?? 0) > 0),
        negative_marks_ratio: 0.25,
        shuffle_questions: true,
        shuffle_options: true,
        is_premium: form.isPremium,
        is_published: form.isPublished,
        is_active: true,
      };

      if (editingId) {
        const response = await fetch(`/api/admin/mock-tests/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: body.title,
            slug: body.slug,
            duration_minutes: Number(form.durationOverride || calculatedDuration),
            is_published: form.isPublished,
            is_premium: form.isPremium,
          }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "Could not update this mock test.");
        toast({ title: "Mock test updated" });
      } else {
        const response = await fetch("/api/mock-tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "Could not create this mock test.");
        toast({
          title: form.isPublished ? "Mock test published" : "Mock test saved as draft",
          description: `${form.title} · ${selectedRows.length} questions · ${durationForDisplay} minutes · ${marksForDisplay} marks`,
        });
      }

      setEditingId(null);
      setForm(EMPTY_FORM);
      setSelectedQuestions({});
      setQuestions([]);
      await loadTests();
    } catch (error) {
      toast({
        title: editingId ? "Update failed" : "Creation failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function editTest(test: MockTest) {
    setEditingId(test.id);
    setSelectedQuestions({});
    setQuestions([]);
    setForm({
      ...EMPTY_FORM,
      title: test.title,
      slug: test.slug,
      durationOverride: String(test.duration_minutes),
      isPublished: test.is_published,
      isPremium: test.is_premium,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function archiveTest(test: MockTest) {
    if (!window.confirm(`Archive "${test.title}"? Students will no longer be able to start it.`)) return;
    try {
      const response = await fetch(`/api/admin/mock-tests/${test.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Archive failed.");
      toast({ title: "Mock test archived" });
      await loadTests();
    } catch (error) {
      toast({ title: "Archive failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  }

  async function loadSections(testId: string) {
    try {
      const response = await getData<TestSection[]>(`/api/admin/mock-tests/${testId}/sections`);
      setSectionTestId(testId);
      setSections(response);
    } catch (error) {
      toast({ title: "Sections could not be loaded", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  }

  async function addSection(testId: string) {
    if (!sectionName.trim()) return;
    try {
      const response = await fetch(`/api/admin/mock-tests/${testId}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sectionName.trim(),
          duration_minutes: sectionDuration ? Number(sectionDuration) : null,
          sort_order: sections.length,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not add section.");
      setSectionName("");
      setSectionDuration("");
      await loadSections(testId);
    } catch (error) {
      toast({ title: "Section creation failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  }

  async function deleteSection(testId: string, sectionId: string) {
    try {
      const response = await fetch(`/api/admin/mock-tests/${testId}/sections?sectionId=${sectionId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not remove section.");
      await loadSections(testId);
    } catch (error) {
      toast({ title: "Section deletion failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Mock test builder</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose the curriculum and test scope, select bank questions, then review the calculated test totals.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>1. Choose curriculum and test type</CardTitle>
            <CardDescription>Select a Board, Class, Subject, and the intended scope for this test.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="test-board">Board</Label>
              <select id="test-board" className="glass-input w-full rounded-md px-3 py-2" value={form.boardId} onChange={(event) => void selectBoard(event.target.value)} required>
                <option value="">Select board</option>
                {boards.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-class">Class</Label>
              <select id="test-class" className="glass-input w-full rounded-md px-3 py-2" value={form.classId} onChange={(event) => void selectClass(event.target.value)} disabled={!form.boardId} required>
                <option value="">Select class</option>
                {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-subject">Subject</Label>
              <select id="test-subject" className="glass-input w-full rounded-md px-3 py-2" value={form.subjectId} onChange={(event) => void selectSubject(event.target.value)} disabled={!form.classId} required>
                <option value="">Select subject</option>
                {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-type">Mock test type</Label>
              <select id="test-type" className="glass-input w-full rounded-md px-3 py-2" value={form.scopeType} onChange={(event) => changeScope(event.target.value as ScopeType)}>
                <option value="chapter_test">Full chapter mock test</option>
                <option value="topic_test">Topic-wise mock test</option>
                <option value="subject_test">Subject mock test</option>
                <option value="full_mock">Complete syllabus mock test</option>
              </select>
            </div>
            {needsChapter && (
              <div className="space-y-2">
                <Label htmlFor="test-chapter">Chapter</Label>
                <select id="test-chapter" className="glass-input w-full rounded-md px-3 py-2" value={form.chapterId} onChange={(event) => void selectChapter(event.target.value)} disabled={!form.subjectId} required>
                  <option value="">Select chapter</option>
                  {chapters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
            )}
            {needsTopic && (
              <div className="space-y-2">
                <Label htmlFor="test-topic">Topic</Label>
                <select id="test-topic" className="glass-input w-full rounded-md px-3 py-2" value={form.topicId} onChange={(event) => {
                  setForm((current) => ({ ...current, topicId: event.target.value }));
                  setSelectedQuestions({});
                }} disabled={!form.chapterId} required>
                  <option value="">Select topic</option>
                  {topics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Select questions</CardTitle>
            <CardDescription>Only published questions assigned to the selected curriculum are available.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search question text" aria-label="Search questions" />
            {!hasQuestionScope ? (
              <p className="text-sm text-muted-foreground">Choose the curriculum above to see available questions.</p>
            ) : loadingQuestions ? (
              <p className="text-sm text-muted-foreground">Loading matching questions…</p>
            ) : questionError ? (
              <p role="alert" className="text-sm text-destructive">{questionError}</p>
            ) : questions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No published, classified questions match this scope yet. Import questions and assign each a topic first.
              </p>
            ) : (
              <div className="max-h-[32rem] space-y-2 overflow-y-auto">
                {questions.map((question) => {
                  const text = question.stem || question.question_text || "Untitled question";
                  const options = question.question_options ?? [];
                  return (
                    <label key={question.id} className="flex cursor-pointer gap-3 rounded-lg border p-3 hover:bg-muted/30">
                      <input type="checkbox" className="mt-1" checked={Boolean(selectedQuestions[question.id])} onChange={() => toggleQuestion(question)} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap gap-2">
                          <Badge variant="outline">{question.question_type?.name ?? question.engine_type ?? "MCQ"}</Badge>
                          <Badge variant="outline">{question.marks ?? 1} marks</Badge>
                          <Badge variant="outline">{question.est_time_sec ?? question.time_seconds ?? 60}s</Badge>
                        </span>
                        <span className="mt-2 block text-sm font-medium">{text}</span>
                        {options.length > 0 && (
                          <span className="mt-2 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                            {options.map((option) => (
                              <span key={option.id}>
                                {option.label ?? "•"}. {option.body ?? option.option_text}
                                {option.is_correct ? " ✓" : ""}
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-sm font-medium">{selectedRows.length} question(s) selected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Test details and calculated totals</CardTitle>
            <CardDescription>Time and marks are derived from the selected questions. Leave overrides blank to use the calculated totals.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="test-title">Test title</Label>
              <Input
                id="test-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  title: event.target.value,
                  slug: editingId ? current.slug : makeSlug(event.target.value),
                }))}
                placeholder="Class 10 Science — Chemical Reactions"
                minLength={2}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-slug">Test URL slug</Label>
              <Input id="test-slug" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: makeSlug(event.target.value) }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-description">Description (optional)</Label>
              <Input id="test-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Calculated duration</Label>
              <p className="rounded-md border bg-muted/20 px-3 py-2 text-sm">{calculatedDuration} min ({calculatedSeconds} seconds)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration-override">Duration override in minutes (optional)</Label>
              <Input id="duration-override" type="number" min={1} step={1} value={form.durationOverride} placeholder={String(calculatedDuration)} onChange={(event) => setForm((current) => ({ ...current, durationOverride: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Calculated total marks</Label>
              <p className="rounded-md border bg-muted/20 px-3 py-2 text-sm">{calculatedMarks}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="marks-override">Total marks override (optional)</Label>
              <Input id="marks-override" type="number" min={0} step="0.01" value={form.marksOverride} placeholder={String(calculatedMarks)} onChange={(event) => setForm((current) => ({ ...current, marksOverride: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Final test totals</Label>
              <p className="rounded-md border bg-primary/5 px-3 py-2 text-sm font-semibold">
                {durationForDisplay || 0} minutes · {marksForDisplay || 0} marks · {selectedRows.length} questions
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isPremium} onChange={(event) => setForm((current) => ({ ...current, isPremium: event.target.checked }))} />
              Premium test
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isPublished} onChange={(event) => setForm((current) => ({ ...current, isPublished: event.target.checked }))} />
              Publish for students
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" disabled={saving || (!editingId && selectedRows.length === 0) || loadingQuestions || (!editingId && !form.subjectId)}>
                {saving ? "Saving…" : editingId ? "Save test details" : form.isPublished ? "Create and publish test" : "Save test draft"}
              </Button>
              {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }}>Cancel edit</Button>}
            </div>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Existing mock tests</CardTitle>
          <CardDescription>Manage availability, sections, and previews.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadError && <p role="alert" className="text-sm text-destructive">{loadError}</p>}
          {tests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No mock tests created yet.</p>
          ) : tests.map((test) => (
            <div key={test.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{test.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {test.total_questions ?? 0} questions · {test.duration_minutes} min · {test.total_marks ?? 0} marks · /{test.slug}
                  </p>
                </div>
                <Badge variant={test.is_published ? "default" : "secondary"}>{test.is_published ? "Published" : "Draft"}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => editTest(test)}>Edit details</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void archiveTest(test)}>Archive</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void loadSections(test.id)}>Sections</Button>
                {test.is_published && <Button type="button" size="sm" variant="outline" asChild><a href={`/test/${test.slug}`} target="_blank" rel="noreferrer">Preview</a></Button>}
              </div>
              {sectionTestId === test.id && (
                <div className="mt-3 space-y-2 rounded-lg bg-muted/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sections</p>
                  {sections.map((section) => (
                    <div key={section.id} className="flex items-center justify-between text-sm">
                      <span>{section.name}{section.duration_minutes ? ` · ${section.duration_minutes} min` : ""}</span>
                      <Button type="button" size="sm" variant="ghost" onClick={() => void deleteSection(test.id, section.id)}>Remove</Button>
                    </div>
                  ))}
                  <div className="grid gap-2 sm:grid-cols-[1fr_110px_auto]">
                    <Input value={sectionName} onChange={(event) => setSectionName(event.target.value)} placeholder="Section name" />
                    <Input type="number" min={1} value={sectionDuration} onChange={(event) => setSectionDuration(event.target.value)} placeholder="Minutes" />
                    <Button type="button" size="sm" onClick={() => void addSection(test.id)}>Add section</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
