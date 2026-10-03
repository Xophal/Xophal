"use client";

import { useEffect, useState } from "react";
import { BookOpen, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { AdminChip, AdminPage, AdminPageHeader, AdminPanel } from "@/components/admin/ui";
import { clientErrorMessage, readApiData } from "@/lib/client-api";

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

  useEffect(() => {
    let active = true;
    void load<Board>("/api/admin/boards").then((rows) => { if (active) setBoards(rows); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!boardId) return;
    let active = true;
    void load<ClassRow>(`/api/admin/classes?boardId=${boardId}`).then((rows) => { if (active) setClasses(rows); });
    return () => { active = false; };
  }, [boardId]);
  useEffect(() => {
    if (!classId) return;
    let active = true;
    void load<Subject>(`/api/admin/subjects?classId=${classId}`).then((rows) => { if (active) setSubjects(rows); });
    return () => { active = false; };
  }, [classId]);
  useEffect(() => {
    if (!subjectId) return;
    let active = true;
    void load<Row>(`/api/admin/chapters?subjectId=${subjectId}`).then((rows) => { if (active) setChapters(rows); });
    return () => { active = false; };
  }, [subjectId]);
  useEffect(() => {
    if (!chapterId) return;
    let active = true;
    void load<Row>(`/api/admin/topics?chapterId=${chapterId}`).then((rows) => { if (active) setTopics(rows); });
    return () => { active = false; };
  }, [chapterId]);

  async function load<T>(url: string): Promise<T[]> {
    try {
      const response = await fetch(url, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not load catalogue");
      return result.data ?? [];
    } catch (error) {
      toast({ title: "Catalogue failed to load", description: error instanceof Error ? error.message : "Please retry.", variant: "destructive" });
      return [];
    }
  }

  async function submit(url: string, body: unknown, reset: () => void, title: string, method: "POST" | "PATCH" = "POST") {
    setSaving(true);
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      await readApiData<unknown>(response, "Could not save this item.");
      toast({ title }); reset();
      setEditingChapterId(null);
      setEditingTopicId(null);
      if (subjectId) setChapters(await load<Row>(`/api/admin/chapters?subjectId=${subjectId}`));
      if (chapterId) setTopics(await load<Row>(`/api/admin/topics?chapterId=${chapterId}`));
    } catch (error) {
      toast({ title: "Save failed", description: clientErrorMessage(error, "Please try again."), variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function archive(url: string, entity: "chapter" | "topic", active: boolean) {
    const response = await fetch(url, active ? { method: "DELETE" } : { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: true }) });
    const result = await response.json();
    if (!response.ok || !result.success) return toast({ title: "Archive failed", description: result.error || "Please try again.", variant: "destructive" });
    toast({ title: `${entity} archived` });
    if (entity === "chapter" && subjectId) setChapters(await load<Row>(`/api/admin/chapters?subjectId=${subjectId}`));
    if (entity === "topic" && chapterId) setTopics(await load<Row>(`/api/admin/topics?chapterId=${chapterId}`));
  }

  return <AdminPage>
    <AdminPageHeader
      eyebrow="Academics"
      title="Chapters & topics"
      description="Build the complete learning hierarchy from the admin frontend."
      actions={<AdminChip tone="info">{chapters.length} chapters · {topics.length} topics</AdminChip>}
    />
    <div className="mt-6">
      <AdminPanel eyebrow="Location" title="Choose location" icon={ListTree}>
        <div className="grid gap-4 md:grid-cols-4">
          <Select label="Board" value={boardId} onChange={(value) => { setBoardId(value); setClassId(""); setSubjectId(""); setChapterId(""); setClasses([]); setSubjects([]); setChapters([]); setTopics([]); }} options={boards} />
          <Select label="Class" value={classId} onChange={(value) => { setClassId(value); setSubjectId(""); setChapterId(""); setSubjects([]); setChapters([]); setTopics([]); }} options={classes} disabled={!boardId} />
          <Select label="Subject" value={subjectId} onChange={(value) => { setSubjectId(value); setChapterId(""); setChapters([]); setTopics([]); }} options={subjects} disabled={!classId} />
          <Select label="Chapter" value={chapterId} onChange={(value) => { setChapterId(value); setTopics([]); }} options={chapters} disabled={!subjectId} />
        </div>
      </AdminPanel>
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <AdminPanel eyebrow="Editor" title={editingChapterId ? "Edit chapter" : "Add chapter"} icon={BookOpen}><form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(editingChapterId ? `/api/admin/chapters/${editingChapterId}` : "/api/admin/chapters", { subject_id: subjectId, code: chapterForm.code, name: chapterForm.name, slug: chapterForm.slug, chapter_number: chapterForm.chapter_number ? Number(chapterForm.chapter_number) : null }, () => setChapterForm({ code: "", name: "", slug: "", chapter_number: "" }), editingChapterId ? "Chapter updated" : "Chapter created", editingChapterId ? "PATCH" : "POST"); }}>
        <Input required placeholder="Code, e.g. CH01" value={chapterForm.code} onChange={(event) => setChapterForm({ ...chapterForm, code: event.target.value })} disabled={!subjectId} />
        <Input required placeholder="Chapter name" value={chapterForm.name} onChange={(event) => setChapterForm({ ...chapterForm, name: event.target.value })} disabled={!subjectId} />
        <Input required placeholder="chapter-slug" value={chapterForm.slug} onChange={(event) => setChapterForm({ ...chapterForm, slug: event.target.value })} disabled={!subjectId} />
        <Input type="number" min="1" placeholder="Chapter number" value={chapterForm.chapter_number} onChange={(event) => setChapterForm({ ...chapterForm, chapter_number: event.target.value })} disabled={!subjectId} />
        <Button type="submit" disabled={saving || !subjectId}>{editingChapterId ? "Save chapter" : "Create chapter"}</Button>{editingChapterId && <Button type="button" variant="ghost" onClick={() => { setEditingChapterId(null); setChapterForm({ code: "", name: "", slug: "", chapter_number: "" }); }}>Cancel edit</Button>}
      </form>
      <div className="mt-5 space-y-2">
        {chapters.length === 0 ? (
          <p className="text-sm text-slate-400">No chapters for this subject yet.</p>
        ) : (
          chapters.map((item) => (
            <div key={item.id} className="admin-row">
              <span className="admin-row-title">{item.chapter_number ? `${item.chapter_number}. ` : ""}{item.name}<small className="ml-2 font-normal text-slate-400">{item.code}</small></span>
              <div className="flex shrink-0 gap-2">
                <AdminChip tone={item.is_active ? "success" : "neutral"}>{item.is_active ? "Active" : "Archived"}</AdminChip>
                <Button type="button" size="sm" variant="outline" onClick={() => { setEditingChapterId(item.id); setChapterForm({ code: item.code, name: item.name, slug: item.slug, chapter_number: item.chapter_number ? String(item.chapter_number) : "" }); }}>Edit</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void archive(`/api/admin/chapters/${item.id}`, "chapter", item.is_active)}>{item.is_active ? "Archive" : "Reactivate"}</Button>
              </div>
            </div>
          ))
        )}
      </div>
    </AdminPanel>
      <AdminPanel eyebrow="Editor" title={editingTopicId ? "Edit topic" : "Add topic"} icon={ListTree}><form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(editingTopicId ? `/api/admin/topics/${editingTopicId}` : "/api/admin/topics", { chapter_id: chapterId, ...topicForm }, () => setTopicForm({ code: "", name: "", slug: "" }), editingTopicId ? "Topic updated" : "Topic created", editingTopicId ? "PATCH" : "POST"); }}>
        <Input required placeholder="Code, e.g. TOP01" value={topicForm.code} onChange={(event) => setTopicForm({ ...topicForm, code: event.target.value })} disabled={!chapterId} />
        <Input required placeholder="Topic name" value={topicForm.name} onChange={(event) => setTopicForm({ ...topicForm, name: event.target.value })} disabled={!chapterId} />
        <Input required placeholder="topic-slug" value={topicForm.slug} onChange={(event) => setTopicForm({ ...topicForm, slug: event.target.value })} disabled={!chapterId} />
        <Button type="submit" disabled={saving || !chapterId}>{editingTopicId ? "Save topic" : "Create topic"}</Button>{editingTopicId && <Button type="button" variant="ghost" onClick={() => { setEditingTopicId(null); setTopicForm({ code: "", name: "", slug: "" }); }}>Cancel edit</Button>}
      </form>
      <div className="mt-5 space-y-2">
        {topics.length === 0 ? (
          <p className="text-sm text-slate-400">No topics for this chapter yet.</p>
        ) : (
          topics.map((item) => (
            <div key={item.id} className="admin-row">
              <span className="admin-row-title">{item.name}<small className="ml-2 font-normal text-slate-400">{item.code}</small></span>
              <div className="flex shrink-0 gap-2">
                <AdminChip tone={item.is_active ? "success" : "neutral"}>{item.is_active ? "Active" : "Archived"}</AdminChip>
                <Button type="button" size="sm" variant="outline" onClick={() => { setEditingTopicId(item.id); setTopicForm({ code: item.code, name: item.name, slug: item.slug }); }}>Edit</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void archive(`/api/admin/topics/${item.id}`, "topic", item.is_active)}>{item.is_active ? "Archive" : "Reactivate"}</Button>
              </div>
            </div>
          ))
        )}
      </div>
    </AdminPanel>
    </div>
  </AdminPage>;
}

function Select({ label, value, onChange, options, disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ id: string; name: string }>; disabled?: boolean }) {
  return <label className="space-y-2 text-sm"><Label>{label}</Label><select className="flex h-10 w-full px-3 py-2 text-sm glass-input" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}><option value="">Select {label.toLowerCase()}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>;
}
