"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type Row = { id: string; code: string; name: string; slug: string; is_active: boolean; chapter_number?: number | null };
type Board = { id: string; name: string };
type ClassRow = { id: string; name: string };
type Subject = { id: string; name: string };

export default function AdminChaptersPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Row[]>([]);
  const [topics, setTopics] = useState<Row[]>([]);
  const [boardId, setBoardId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [chapterForm, setChapterForm] = useState({ code: "", name: "", slug: "", chapter_number: "" });
  const [topicForm, setTopicForm] = useState({ code: "", name: "", slug: "" });
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load("/api/admin/boards", setBoards); }, []);
  useEffect(() => { setClassId(""); setSubjectId(""); setChapterId(""); setClasses([]); setSubjects([]); setChapters([]); setTopics([]); if (boardId) void load(`/api/admin/classes?boardId=${boardId}`, setClasses); }, [boardId]);
  useEffect(() => { setSubjectId(""); setChapterId(""); setSubjects([]); setChapters([]); setTopics([]); if (classId) void load(`/api/admin/subjects?classId=${classId}`, setSubjects); }, [classId]);
  useEffect(() => { setChapterId(""); setChapters([]); setTopics([]); if (subjectId) void load(`/api/admin/chapters?subjectId=${subjectId}`, setChapters); }, [subjectId]);
  useEffect(() => { setTopics([]); if (chapterId) void load(`/api/admin/topics?chapterId=${chapterId}`, setTopics); }, [chapterId]);

  async function load<T>(url: string, setter: (value: T[]) => void) {
    const response = await fetch(url, { cache: "no-store" });
    const result = await response.json();
    if (response.ok && result.success) setter(result.data ?? []);
  }

  async function submit(url: string, body: unknown, reset: () => void, title: string, method: "POST" | "PATCH" = "POST") {
    setSaving(true);
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Save failed");
      toast({ title }); reset();
      setEditingChapterId(null);
      setEditingTopicId(null);
      if (subjectId) await load(`/api/admin/chapters?subjectId=${subjectId}`, setChapters);
      if (chapterId) await load(`/api/admin/topics?chapterId=${chapterId}`, setTopics);
    } catch (error) {
      toast({ title: "Save failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function archive(url: string, entity: "chapter" | "topic", active: boolean) {
    const response = await fetch(url, active ? { method: "DELETE" } : { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: true }) });
    const result = await response.json();
    if (!response.ok || !result.success) return toast({ title: "Archive failed", description: result.error || "Please try again.", variant: "destructive" });
    toast({ title: `${entity} archived` });
    if (entity === "chapter" && subjectId) await load(`/api/admin/chapters?subjectId=${subjectId}`, setChapters);
    if (entity === "topic" && chapterId) await load(`/api/admin/topics?chapterId=${chapterId}`, setTopics);
  }

  return <div className="space-y-6 p-6">
    <div><h1 className="text-3xl font-semibold">Chapters & topics</h1><p className="mt-2 text-sm text-muted-foreground">Build the complete learning hierarchy from the admin frontend.</p></div>
    <Card><CardHeader><CardTitle>Choose location</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-4">
      <Select label="Board" value={boardId} onChange={setBoardId} options={boards} />
      <Select label="Class" value={classId} onChange={setClassId} options={classes} disabled={!boardId} />
      <Select label="Subject" value={subjectId} onChange={setSubjectId} options={subjects} disabled={!classId} />
      <Select label="Chapter" value={chapterId} onChange={setChapterId} options={chapters} disabled={!subjectId} />
    </CardContent></Card>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>{editingChapterId ? "Edit chapter" : "Add chapter"}</CardTitle></CardHeader><CardContent><form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(editingChapterId ? `/api/admin/chapters/${editingChapterId}` : "/api/admin/chapters", { subject_id: subjectId, code: chapterForm.code, name: chapterForm.name, slug: chapterForm.slug, chapter_number: chapterForm.chapter_number ? Number(chapterForm.chapter_number) : null }, () => setChapterForm({ code: "", name: "", slug: "", chapter_number: "" }), editingChapterId ? "Chapter updated" : "Chapter created", editingChapterId ? "PATCH" : "POST"); }}>
        <Input required placeholder="Code, e.g. CH01" value={chapterForm.code} onChange={(event) => setChapterForm({ ...chapterForm, code: event.target.value })} disabled={!subjectId} />
        <Input required placeholder="Chapter name" value={chapterForm.name} onChange={(event) => setChapterForm({ ...chapterForm, name: event.target.value })} disabled={!subjectId} />
        <Input required placeholder="chapter-slug" value={chapterForm.slug} onChange={(event) => setChapterForm({ ...chapterForm, slug: event.target.value })} disabled={!subjectId} />
        <Input type="number" min="1" placeholder="Chapter number" value={chapterForm.chapter_number} onChange={(event) => setChapterForm({ ...chapterForm, chapter_number: event.target.value })} disabled={!subjectId} />
        <Button type="submit" disabled={saving || !subjectId}>{editingChapterId ? "Save chapter" : "Create chapter"}</Button>{editingChapterId && <Button type="button" variant="ghost" onClick={() => { setEditingChapterId(null); setChapterForm({ code: "", name: "", slug: "", chapter_number: "" }); }}>Cancel edit</Button>}
      </form><div className="mt-5 space-y-2">{chapters.map((item) => <div key={item.id} className="flex items-center justify-between rounded border p-3"><span>{item.chapter_number ? `${item.chapter_number}. ` : ""}{item.name}<small className="ml-2 text-muted-foreground">{item.code}</small></span><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => { setEditingChapterId(item.id); setChapterForm({ code: item.code, name: item.name, slug: item.slug, chapter_number: item.chapter_number ? String(item.chapter_number) : "" }); }}>Edit</Button><Button type="button" size="sm" variant="outline" onClick={() => void archive(`/api/admin/chapters/${item.id}`, "chapter", item.is_active)}>{item.is_active ? "Archive" : "Reactivate"}</Button></div></div>)}</div></CardContent></Card>
      <Card><CardHeader><CardTitle>{editingTopicId ? "Edit topic" : "Add topic"}</CardTitle></CardHeader><CardContent><form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(editingTopicId ? `/api/admin/topics/${editingTopicId}` : "/api/admin/topics", { chapter_id: chapterId, ...topicForm }, () => setTopicForm({ code: "", name: "", slug: "" }), editingTopicId ? "Topic updated" : "Topic created", editingTopicId ? "PATCH" : "POST"); }}>
        <Input required placeholder="Code, e.g. TOP01" value={topicForm.code} onChange={(event) => setTopicForm({ ...topicForm, code: event.target.value })} disabled={!chapterId} />
        <Input required placeholder="Topic name" value={topicForm.name} onChange={(event) => setTopicForm({ ...topicForm, name: event.target.value })} disabled={!chapterId} />
        <Input required placeholder="topic-slug" value={topicForm.slug} onChange={(event) => setTopicForm({ ...topicForm, slug: event.target.value })} disabled={!chapterId} />
        <Button type="submit" disabled={saving || !chapterId}>{editingTopicId ? "Save topic" : "Create topic"}</Button>{editingTopicId && <Button type="button" variant="ghost" onClick={() => { setEditingTopicId(null); setTopicForm({ code: "", name: "", slug: "" }); }}>Cancel edit</Button>}
      </form><div className="mt-5 space-y-2">{topics.map((item) => <div key={item.id} className="flex items-center justify-between rounded border p-3"><span>{item.name}<small className="ml-2 text-muted-foreground">{item.code}</small></span><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => { setEditingTopicId(item.id); setTopicForm({ code: item.code, name: item.name, slug: item.slug }); }}>Edit</Button><Button type="button" size="sm" variant="outline" onClick={() => void archive(`/api/admin/topics/${item.id}`, "topic", item.is_active)}>{item.is_active ? "Archive" : "Reactivate"}</Button></div></div>)}</div></CardContent></Card>
    </div>
  </div>;
}

function Select({ label, value, onChange, options, disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ id: string; name: string }>; disabled?: boolean }) {
  return <label className="space-y-2 text-sm"><Label>{label}</Label><select className="flex h-10 w-full px-3 py-2 text-sm glass-input" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}><option value="">Select {label.toLowerCase()}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>;
}
