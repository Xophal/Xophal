"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { slugify } from "@/lib/utils";

type MockTest = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  instructions: string | null;
  duration_minutes: number;
  passing_marks: number | null;
  negative_marking: boolean;
  negative_marks_ratio: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  show_solutions: boolean;
  allow_review: boolean;
  max_attempts: number;
  access_price: number;
  total_questions: number;
  total_marks: number;
  is_published: boolean;
  is_premium: boolean;
  is_active: boolean;
};
type TestSection = { id: string; name: string; sort_order: number };
type TestQuestion = {
  id: string;
  question_text: string;
  marks: number | string | null;
  marks_override?: number | string | null;
  sort_order?: number;
  section_id?: string | null;
  section_name?: string | null;
};
type QuestionManagerResponse = {
  success: boolean;
  error?: string;
  data?: { attachedQuestions: TestQuestion[]; availableQuestions: TestQuestion[] };
};

const blankTest = {
  title: "",
  slug: "",
  description: "",
  instructions: "",
  duration_minutes: 45,
  passing_marks: 0,
  negative_marking: false,
  negative_marks_ratio: 0.25,
  shuffle_questions: true,
  shuffle_options: true,
  show_solutions: true,
  allow_review: true,
  max_attempts: 0,
  access_price: 0,
  is_published: false,
  is_premium: false,
};

export default function AdminMockTestsPage() {
  const [tests, setTests] = useState<MockTest[]>([]);
  const [form, setForm] = useState(blankTest);
  const [slugEdited, setSlugEdited] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<TestSection[]>([]);
  const [sectionsTestId, setSectionsTestId] = useState<string | null>(null);
  const [sectionName, setSectionName] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [managingTestId, setManagingTestId] = useState<string | null>(null);
  const [availableQuestions, setAvailableQuestions] = useState<TestQuestion[]>([]);
  const [attachedQuestions, setAttachedQuestions] = useState<TestQuestion[]>([]);
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionActionId, setQuestionActionId] = useState<string | null>(null);

  useEffect(() => {
    void loadTests().catch((error) => {
      toast({
        title: "Mock tests failed to load",
        description: error instanceof Error ? error.message : "Please refresh and try again.",
        variant: "destructive",
      });
    });
  }, []);

  async function loadTests() {
    const response = await fetch("/api/admin/mock-tests", { cache: "no-store" });
    const result = await response.json().catch(() => null) as { success?: boolean; data?: MockTest[]; error?: string } | null;
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || `Could not load mock tests (${response.status})`);
    }
    setTests(result.data || []);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(editingId ? `/api/admin/mock-tests/${editingId}` : "/api/mock-tests", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ...(editingId ? { is_published: undefined } : {}),
          slug: form.slug || slugify(form.title),
          subject_id: null,
          chapter_id: null,
          is_active: editingId ? undefined : true,
        }),
      });
      const result = await response.json().catch(() => null) as { success?: boolean; error?: string } | null;

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || `Could not save mock test (${response.status})`);
      }

      toast({ title: editingId ? "Mock test updated" : "Mock test created", description: `${form.title} has been saved.` });
      setForm(blankTest);
      setSlugEdited(false);
      setEditingId(null);
      try {
        await loadTests();
      } catch (error) {
        toast({
          title: "Mock test saved, but list refresh failed",
          description: error instanceof Error ? error.message : "Refresh the page to see the saved test.",
          variant: "destructive",
        });
      }
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

  function editTest(item: MockTest) {
    setEditingId(item.id);
    setSlugEdited(true);
    setForm({
      title: item.title,
      slug: item.slug,
      description: item.description ?? "",
      instructions: item.instructions ?? "",
      duration_minutes: item.duration_minutes,
      passing_marks: Number(item.passing_marks ?? 0),
      negative_marking: item.negative_marking ?? false,
      negative_marks_ratio: Number(item.negative_marks_ratio ?? 0.25),
      shuffle_questions: item.shuffle_questions ?? true,
      shuffle_options: item.shuffle_options ?? true,
      show_solutions: item.show_solutions ?? true,
      allow_review: item.allow_review ?? true,
      max_attempts: item.max_attempts ?? 0,
      access_price: item.access_price ?? 0,
      is_published: item.is_published,
      is_premium: item.is_premium,
    });
  }

  function resetForm() {
    setEditingId(null);
    setSlugEdited(false);
    setForm(blankTest);
  }

  async function archiveTest(item: MockTest) {
    const response = await fetch(`/api/admin/mock-tests/${item.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok || !result.success) return toast({ title: "Archive failed", description: result.error || "Please try again.", variant: "destructive" });
    await loadTests();
  }

  async function loadSections(testId: string, showPanel = true) {
    const response = await fetch(`/api/admin/mock-tests/${testId}/sections`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || "Could not load test sections.");
    if (showPanel) setSectionsTestId(testId);
    setSections(result.data ?? []);
  }

  async function addSection(testId: string) {
    if (!sectionName.trim()) return;
    const sortOrder = sections.reduce((max, section) => Math.max(max, section.sort_order), -1) + 1;
    const response = await fetch(`/api/admin/mock-tests/${testId}/sections`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: sectionName, sort_order: sortOrder }) });
    const result = await response.json();
    if (!response.ok || !result.success) return toast({ title: "Section creation failed", description: result.error || "Please try again.", variant: "destructive" });
    setSectionName(""); await loadSections(testId);
  }

  async function loadTestQuestions(testId: string, search = questionSearch) {
    setQuestionsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`/api/admin/mock-tests/${testId}/questions?${params}`, { cache: "no-store" });
      const result = await response.json() as QuestionManagerResponse;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || "Could not load questions.");
      }
      setAttachedQuestions(result.data.attachedQuestions);
      setAvailableQuestions(result.data.availableQuestions);
    } finally {
      setQuestionsLoading(false);
    }
  }

  async function manageQuestions(testId: string) {
    setManagingTestId(managingTestId === testId ? null : testId);
    setQuestionSearch("");
    setSelectedSectionId("");
    try {
      await Promise.all([loadTestQuestions(testId, ""), loadSections(testId, false)]);
    } catch (error) {
      toast({
        title: "Questions could not be loaded",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  async function attachQuestion(testId: string, questionId: string) {
    setQuestionActionId(questionId);
    try {
      const response = await fetch(`/api/admin/mock-tests/${testId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_ids: [questionId], section_id: selectedSectionId || null }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not add question.");
      await Promise.all([loadTestQuestions(testId), loadTests()]);
      toast({ title: "Question added to test" });
    } catch (error) {
      toast({
        title: "Could not add question",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setQuestionActionId(null);
    }
  }

  async function assignQuestionSection(testId: string, questionId: string, sectionId: string) {
    setQuestionActionId(questionId);
    try {
      const response = await fetch(`/api/admin/mock-tests/${testId}/questions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: questionId, section_id: sectionId || null }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not update question section.");
      await Promise.all([loadTestQuestions(testId), loadTests()]);
      toast({ title: "Question section updated" });
    } catch (error) {
      toast({
        title: "Could not update question section",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setQuestionActionId(null);
    }
  }

  async function removeQuestion(testId: string, questionId: string) {
    setQuestionActionId(questionId);
    try {
      const response = await fetch(`/api/admin/mock-tests/${testId}/questions?questionId=${questionId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not remove question.");
      await Promise.all([loadTestQuestions(testId), loadTests()]);
      toast({ title: "Question removed from test" });
    } catch (error) {
      toast({
        title: "Could not remove question",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setQuestionActionId(null);
    }
  }

  async function togglePublished(item: MockTest) {
    try {
      const response = await fetch(`/api/admin/mock-tests/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: !item.is_published }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not update publication.");
      await loadTests();
      toast({ title: item.is_published ? "Test unpublished" : "Test published" });
    } catch (error) {
      toast({
        title: "Publication update failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  async function deleteSection(testId: string, sectionId: string) {
    const response = await fetch(`/api/admin/mock-tests/${testId}/sections?sectionId=${sectionId}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok || !result.success) return toast({ title: "Section deletion failed", description: result.error || "Please try again.", variant: "destructive" });
    await Promise.all([loadSections(testId), loadTests(), loadTestQuestions(testId)]);
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Mock tests</h1>
        <p className="mt-2 text-sm text-muted-foreground">Create student-facing practice tests and publish them for exam readiness.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit test" : "Add test"}</CardTitle>
            <CardDescription>Setup a timed mock exam with a title, slug, and duration.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-title">Title</Label>
                <Input id="test-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, ...(!slugEdited ? { slug: slugify(e.target.value) } : {}) })} placeholder="Class 10 Science Full Test" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-slug">URL slug</Label>
                <Input id="test-slug" value={form.slug} onChange={(e) => { setSlugEdited(true); setForm({ ...form, slug: e.target.value }); }} placeholder="Generated from the title" />
                <p className="text-xs text-muted-foreground">Generated from the title. You can edit it before saving.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-description">Student-facing description</Label>
                <Textarea id="test-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={10000} rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-duration">Duration (minutes)</Label>
                <Input id="test-duration" type="number" min={5} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) || 45 })} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="test-passing-marks">Passing marks</Label>
                  <Input id="test-passing-marks" type="number" min={0} step="0.5" value={form.passing_marks} onChange={(e) => setForm({ ...form, passing_marks: Number(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="test-max-attempts">Maximum attempts (0 = unlimited)</Label>
                  <Input id="test-max-attempts" type="number" min={0} step={1} value={form.max_attempts} onChange={(e) => setForm({ ...form, max_attempts: Number(e.target.value) || 0 })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_premium} onChange={(e) => setForm({ ...form, is_premium: e.target.checked })} />
                Premium test
              </label>
              {form.is_premium ? (
                <div className="space-y-2">
                  <Label htmlFor="test-access-price">One-time UPI price (₹)</Label>
                  <Input
                    id="test-access-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.access_price}
                    onChange={(e) => setForm({ ...form, access_price: Number(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">Set 0 to include this test only with an active premium subscription.</p>
                </div>
              ) : null}
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-medium">Exam behavior</p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.negative_marking} onChange={(e) => setForm({ ...form, negative_marking: e.target.checked })} />
                  Enable negative marking
                </label>
                {form.negative_marking ? (
                  <div className="space-y-2">
                    <Label htmlFor="test-negative-ratio">Deduction ratio per wrong answer</Label>
                    <Input id="test-negative-ratio" type="number" min={0} max={1} step="0.05" value={form.negative_marks_ratio} onChange={(e) => setForm({ ...form, negative_marks_ratio: Number(e.target.value) || 0 })} />
                  </div>
                ) : null}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.shuffle_questions} onChange={(e) => setForm({ ...form, shuffle_questions: e.target.checked })} />
                  Shuffle questions per attempt
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.shuffle_options} onChange={(e) => setForm({ ...form, shuffle_options: e.target.checked })} />
                  Shuffle answer options per attempt
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.allow_review} onChange={(e) => setForm({ ...form, allow_review: e.target.checked })} />
                  Allow review and bookmarking
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.show_solutions} onChange={(e) => setForm({ ...form, show_solutions: e.target.checked })} />
                  Show explanations in results
                </label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-instructions">Student instructions</Label>
                <Textarea id="test-instructions" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} maxLength={10000} rows={4} />
              </div>
              <p className="text-xs text-muted-foreground">Tests stay in draft until they contain published questions and you publish them.</p>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Save test" : "Create test"}
              </Button>
              {editingId && <Button type="button" variant="ghost" className="w-full" onClick={resetForm}>Cancel edit</Button>}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Existing tests</CardTitle>
            <CardDescription>Available test catalog for students.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tests.length === 0 ? <p className="text-sm text-muted-foreground">No mock tests created yet.</p> : tests.map((item) => (
                <div key={item.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{item.title}</p>
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                      {item.is_published ? "Published" : "Draft"}{item.is_premium ? " • Premium" : " • Free"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.duration_minutes} mins • {item.total_questions} questions • /{item.slug}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => editTest(item)}>Edit</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void manageQuestions(item.id)}>Questions</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void loadSections(item.id).catch((error) => toast({ title: "Sections could not be loaded", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }))}>Sections</Button>
                    <Button type="button" size="sm" variant={item.is_published ? "outline" : "default"} disabled={!item.is_published && item.total_questions === 0} onClick={() => void togglePublished(item)}>
                      {item.is_published ? "Unpublish" : "Publish"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => void archiveTest(item)}>Archive</Button>
                    <Button type="button" size="sm" variant="outline" asChild><a href={`/test/${item.slug}`} target="_blank" rel="noreferrer">Preview</a></Button>
                  </div>
                  {managingTestId === item.id && (
                    <div className="mt-3 space-y-4 rounded-lg bg-muted/40 p-3">
                      <div>
                        <p className="text-sm font-semibold">Questions in this test</p>
                        <p className="mt-1 text-xs text-muted-foreground">Only published, active multiple-choice questions with answer keys can be added.</p>
                      </div>
                      {attachedQuestions.length > 0 ? (
                        <div className="space-y-2">
                          {attachedQuestions.map((question) => (
                            <div key={question.id} className="flex flex-wrap items-start justify-between gap-2 text-sm">
                              <span className="min-w-0 flex-1">{question.question_text}<span className="ml-2 text-xs text-muted-foreground">({question.marks_override ?? question.marks ?? 0} marks){question.section_name ? ` • ${question.section_name}` : ""}</span></span>
                              <div className="flex items-center gap-2">
                                <select
                                  aria-label={`Section for ${question.question_text}`}
                                  className="h-9 max-w-40 rounded-md border border-border bg-background px-2 text-xs"
                                  value={question.section_id ?? ""}
                                  disabled={questionActionId === question.id}
                                  onChange={(event) => void assignQuestionSection(item.id, question.id, event.target.value)}
                                >
                                  <option value="">No section</option>
                                  {sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                                </select>
                                <Button type="button" size="sm" variant="ghost" disabled={questionActionId === question.id} onClick={() => void removeQuestion(item.id, question.id)}>Remove</Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-sm text-muted-foreground">No questions have been added.</p>}
                      {sections.length > 0 ? (
                        <div className="space-y-1">
                          <Label htmlFor={`question-section-${item.id}`}>Add new questions to</Label>
                          <select
                            id={`question-section-${item.id}`}
                            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                            value={selectedSectionId}
                            onChange={(event) => setSelectedSectionId(event.target.value)}
                          >
                            <option value="">No section</option>
                            {sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                          </select>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Create sections to organize questions in the test.</p>
                      )}
                      <Input
                        value={questionSearch}
                        onChange={(event) => {
                          const search = event.target.value;
                          setQuestionSearch(search);
                          void loadTestQuestions(item.id, search).catch((error) => toast({ title: "Question search failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }));
                        }}
                        placeholder="Search published question bank"
                      />
                      {questionsLoading ? <p className="text-sm text-muted-foreground">Loading questions…</p> : availableQuestions.length > 0 ? (
                        <div className="max-h-64 space-y-2 overflow-y-auto">
                          {availableQuestions.map((question) => (
                            <div key={question.id} className="flex items-start justify-between gap-2 text-sm">
                              <span>{question.question_text}<span className="ml-2 text-xs text-muted-foreground">({question.marks ?? 0} marks)</span></span>
                              <Button type="button" size="sm" variant="outline" disabled={questionActionId === question.id} onClick={() => void attachQuestion(item.id, question.id)}>Add</Button>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-sm text-muted-foreground">No eligible published questions found. <a className="font-medium text-primary underline" href="/admin/questions">Create and publish questions</a>, then return here.</p>}
                    </div>
                  )}
                  {sectionsTestId === item.id && (
                    <div className="mt-3 space-y-2 rounded-lg bg-muted/40 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sections</p>
                      {sections.map((section) => <div key={section.id} className="flex items-center justify-between text-sm"><span>{section.name}</span><Button type="button" size="sm" variant="ghost" onClick={() => void deleteSection(item.id, section.id)}>Remove</Button></div>)}
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]"><Input value={sectionName} onChange={(e) => setSectionName(e.target.value)} placeholder="Section name" /><Button type="button" size="sm" onClick={() => void addSection(item.id)}>Add section</Button></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
