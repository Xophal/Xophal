"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type Board = { id: string; name: string; code: string };
type ClassItem = { id: string; board_id: string; name: string; code: string; slug: string };
type SubjectItem = { id: string; class_id: string; code: string; name: string; slug: string; color?: string | null; is_active: boolean };

const blankSubject = { board_id: "", class_id: "", code: "", name: "", slug: "", color: "#3b82f6", is_active: true };

export default function AdminSubjectsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [form, setForm] = useState(blankSubject);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBoards();
  }, []);

  useEffect(() => {
    if (!form.board_id) {
      setClasses([]);
      setSubjects([]);
      setForm((current) => ({ ...current, class_id: "" }));
      return;
    }

    loadClassesByBoard(form.board_id);
  }, [form.board_id]);

  useEffect(() => {
    if (!form.class_id) {
      setSubjects([]);
      return;
    }
    loadSubjectsByClass(form.class_id);
  }, [form.class_id]);

  async function loadBoards() {
    const res = await fetch("/api/admin/boards", { cache: "no-store" });
    const json = await res.json();
    if (res.ok && json.success) setBoards(json.data || []);
  }

  async function loadClassesByBoard(boardId: string) {
    const res = await fetch(`/api/admin/classes?boardId=${boardId}`, { cache: "no-store" });
    const json = await res.json();
    if (res.ok && json.success) setClasses(json.data || []);
    setForm((current) => ({ ...current, class_id: "" }));
    setSubjects([]);
  }

  async function loadSubjectsByClass(classId: string) {
    const res = await fetch(`/api/admin/subjects?classId=${classId}`, { cache: "no-store" });
    const json = await res.json();
    if (res.ok && json.success) setSubjects(json.data || []);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(editingId ? `/api/admin/subjects/${editingId}` : "/api/admin/subjects", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, sort_order: editingId ? undefined : subjects.length }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Could not create subject");
      }

      toast({ title: editingId ? "Subject updated" : "Subject created", description: `${form.name} has been saved.` });
      setEditingId(null);
      setForm({ ...blankSubject, board_id: form.board_id });
      await loadSubjectsByClass(form.class_id);
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

  async function toggleSubject(item: SubjectItem) {
    const response = await fetch(`/api/admin/subjects/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: !item.is_active }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) return toast({ title: "Update failed", description: result.error || "Could not update subject", variant: "destructive" });
    if (form.class_id) await loadSubjectsByClass(form.class_id);
  }

  function editSubject(item: SubjectItem) {
    setEditingId(item.id);
    setForm({ board_id: form.board_id, class_id: item.class_id, code: item.code, name: item.name, slug: item.slug, color: item.color || "#3b82f6", is_active: item.is_active });
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Subjects</h1>
        <p className="mt-2 text-sm text-muted-foreground">Add subjects under each class to organize lessons and notes.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit subject" : "Add subject"}</CardTitle>
            <CardDescription>Select the board and class, then add the subject taxonomy.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject-board">Board</Label>
                <select id="subject-board" value={form.board_id} onChange={(e) => setForm({ ...blankSubject, board_id: e.target.value })} className="flex h-10 w-full px-3 py-2 text-sm glass-input" required>
                  <option value="">Select board</option>
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>{board.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject-class">Class</Label>
                <select id="subject-class" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} className="flex h-10 w-full px-3 py-2 text-sm glass-input" required disabled={!form.board_id}>
                  <option value="">Select class</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject-code">Code</Label>
                <Input id="subject-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="MATH" required disabled={!form.class_id} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject-name">Name</Label>
                <Input id="subject-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mathematics" required disabled={!form.class_id} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject-slug">Slug</Label>
                <Input id="subject-slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="mathematics" required disabled={!form.class_id} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject-color">Color</Label>
                <Input id="subject-color" type="color" value={form.color || "#3b82f6"} onChange={(e) => setForm({ ...form, color: e.target.value })} disabled={!form.class_id} />
              </div>
              <Button type="submit" className="w-full" disabled={saving || !form.class_id}>
                {saving ? "Saving..." : editingId ? "Save subject" : "Create subject"}
              </Button>
              {editingId && <Button type="button" variant="ghost" className="w-full" onClick={() => { setEditingId(null); setForm({ ...blankSubject, board_id: form.board_id, class_id: form.class_id }); }}>Cancel edit</Button>}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subjects in selected class</CardTitle>
            <CardDescription>Existing subject set for the chosen class.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {!form.class_id ? <p className="text-sm text-muted-foreground">Select a class to view subjects.</p> : subjects.length === 0 ? <p className="text-sm text-muted-foreground">No subjects for this class yet.</p> : subjects.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-4">
                  <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{item.name}</p>
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color || "#3b82f6" }} />
                  </div>
                  <p className="text-sm text-muted-foreground">{item.code} • {item.slug}</p>
                  </div>
                  <div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => editSubject(item)}>Edit</Button><Button type="button" size="sm" variant="outline" onClick={() => void toggleSubject(item)}>{item.is_active ? "Archive" : "Reactivate"}</Button></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
