"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type MockTest = {
  id: string;
  title: string;
  slug: string;
  duration_minutes: number;
  is_published: boolean;
  is_premium: boolean;
  is_active: boolean;
};
type TestSection = { id: string; name: string; duration_minutes: number | null };

const blankTest = {
  title: "",
  slug: "",
  duration_minutes: 45,
  is_published: true,
  is_premium: false,
};

export default function AdminMockTestsPage() {
  const [tests, setTests] = useState<MockTest[]>([]);
  const [form, setForm] = useState(blankTest);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<TestSection[]>([]);
  const [sectionName, setSectionName] = useState("");
  const [sectionDuration, setSectionDuration] = useState("");

  useEffect(() => {
    loadTests();
  }, []);

  async function loadTests() {
    const res = await fetch("/api/admin/mock-tests", { cache: "no-store" });
    const json = await res.json();
    if (res.ok && json.success) setTests(json.data || []);
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
          subject_id: null,
          chapter_id: null,
          passing_marks: 30,
          negative_marking: false,
          negative_marks_ratio: 0.25,
          shuffle_questions: true,
          shuffle_options: true,
          is_active: editingId ? undefined : true,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Could not create mock test");
      }

      toast({ title: editingId ? "Mock test updated" : "Mock test created", description: `${form.title} has been saved.` });
      setForm(blankTest);
      setEditingId(null);
      await loadTests();
    } catch (error) {
      toast({
        title: "Creation failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function editTest(item: MockTest) {
    setEditingId(item.id);
    setForm({ title: item.title, slug: item.slug, duration_minutes: item.duration_minutes, is_published: item.is_published, is_premium: item.is_premium });
  }

  async function archiveTest(item: MockTest) {
    const response = await fetch(`/api/admin/mock-tests/${item.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok || !result.success) return toast({ title: "Archive failed", description: result.error || "Please try again.", variant: "destructive" });
    await loadTests();
  }

  async function loadSections(testId: string) {
    const response = await fetch(`/api/admin/mock-tests/${testId}/sections`, { cache: "no-store" });
    const result = await response.json();
    if (response.ok && result.success) setSections(result.data ?? []);
  }

  async function addSection(testId: string) {
    if (!sectionName.trim()) return;
    const response = await fetch(`/api/admin/mock-tests/${testId}/sections`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: sectionName, duration_minutes: sectionDuration ? Number(sectionDuration) : null, sort_order: sections.length }) });
    const result = await response.json();
    if (!response.ok || !result.success) return toast({ title: "Section creation failed", description: result.error || "Please try again.", variant: "destructive" });
    setSectionName(""); setSectionDuration(""); await loadSections(testId);
  }

  async function deleteSection(testId: string, sectionId: string) {
    const response = await fetch(`/api/admin/mock-tests/${testId}/sections?sectionId=${sectionId}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok || !result.success) return toast({ title: "Section deletion failed", description: result.error || "Please try again.", variant: "destructive" });
    await loadSections(testId);
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
                <Input id="test-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Class 10 Science Full Test" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-slug">Slug</Label>
                <Input id="test-slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="class-10-science-full-test" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-duration">Duration (minutes)</Label>
                <Input id="test-duration" type="number" min={5} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) || 45 })} required />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_premium} onChange={(e) => setForm({ ...form, is_premium: e.target.checked })} />
                Premium test
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
                Published for students
              </label>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Save test" : "Create test"}
              </Button>
              {editingId && <Button type="button" variant="ghost" className="w-full" onClick={() => { setEditingId(null); setForm(blankTest); }}>Cancel edit</Button>}
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
                      {item.is_premium ? "Premium" : "Free"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.duration_minutes} mins • /{item.slug}</p>
                  <div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => editTest(item)}>Edit</Button><Button type="button" size="sm" variant="outline" onClick={() => void archiveTest(item)}>Archive</Button><Button type="button" size="sm" variant="outline" asChild><a href={`/test/${item.slug}`} target="_blank" rel="noreferrer">Preview</a></Button><Button type="button" size="sm" variant="outline" onClick={() => void loadSections(item.id)}>Sections</Button></div>
                  {sections.length > 0 && <div className="mt-3 space-y-2 rounded-lg bg-muted/40 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sections</p>{sections.map((section) => <div key={section.id} className="flex items-center justify-between text-sm"><span>{section.name}{section.duration_minutes ? ` • ${section.duration_minutes} min` : ""}</span><Button type="button" size="sm" variant="ghost" onClick={() => void deleteSection(item.id, section.id)}>Remove</Button></div>)}<div className="grid gap-2 sm:grid-cols-[1fr_110px_auto]"><Input value={sectionName} onChange={(e) => setSectionName(e.target.value)} placeholder="Section name" /><Input type="number" min={1} value={sectionDuration} onChange={(e) => setSectionDuration(e.target.value)} placeholder="Minutes" /><Button type="button" size="sm" onClick={() => void addSection(item.id)}>Add section</Button></div></div>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
