"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type Board = { id: string; name: string; code: string };
type ClassItem = { id: string; board_id: string; code: string; name: string; slug: string; grade_number?: number | null; is_active: boolean };

const blankClass = { board_id: "", code: "", name: "", slug: "", grade_number: "", is_active: true };

export default function AdminClassesPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [form, setForm] = useState(blankClass);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBoards();
  }, []);

  useEffect(() => {
    if (form.board_id) loadClasses(form.board_id);
  }, [form.board_id]);

  async function loadBoards() {
    const res = await fetch("/api/admin/boards", { cache: "no-store" });
    const json = await res.json();
    if (res.ok && json.success) setBoards(json.data || []);
  }

  async function loadClasses(boardId: string) {
    const res = await fetch(`/api/admin/classes?boardId=${boardId}`, { cache: "no-store" });
    const json = await res.json();
    if (res.ok && json.success) setClasses(json.data || []);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(editingId ? `/api/admin/classes/${editingId}` : "/api/admin/classes", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          grade_number: form.grade_number ? Number(form.grade_number) : undefined,
          sort_order: editingId ? undefined : classes.length,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Could not create class");
      }

      toast({ title: editingId ? "Class updated" : "Class created", description: `${form.name} has been saved.` });
      setEditingId(null);
      setForm({ ...blankClass, board_id: form.board_id });
      await loadClasses(form.board_id);
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

  async function toggleClass(item: ClassItem) {
    const response = await fetch(`/api/admin/classes/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: !item.is_active }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) return toast({ title: "Update failed", description: result.error || "Could not update class", variant: "destructive" });
    if (form.board_id) await loadClasses(form.board_id);
  }

  function editClass(item: ClassItem) {
    setEditingId(item.id);
    setForm({ board_id: item.board_id, code: item.code, name: item.name, slug: item.slug, grade_number: item.grade_number ? String(item.grade_number) : "", is_active: item.is_active });
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Classes</h1>
        <p className="mt-2 text-sm text-muted-foreground">Map grades to each board so students can unlock board-specific learning.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit class" : "Add class"}</CardTitle>
            <CardDescription>Associate a class with the relevant board.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="class-board">Board</Label>
                <select id="class-board" value={form.board_id} onChange={(e) => setForm({ ...form, board_id: e.target.value })} className="flex h-10 w-full px-3 py-2 text-sm glass-input" required>
                  <option value="">Select board</option>
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>{board.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-code">Code</Label>
                <Input id="class-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CLASS10" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-name">Name</Label>
                <Input id="class-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Class 10" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-slug">Slug</Label>
                <Input id="class-slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="class-10" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-grade">Grade number</Label>
                <Input id="class-grade" type="number" min={1} max={12} value={form.grade_number} onChange={(e) => setForm({ ...form, grade_number: e.target.value })} placeholder="10" />
              </div>
              <Button type="submit" className="w-full" disabled={saving || !form.board_id}>
                {saving ? "Saving..." : editingId ? "Save class" : "Create class"}
              </Button>
              {editingId && <Button type="button" variant="ghost" className="w-full" onClick={() => { setEditingId(null); setForm({ ...blankClass, board_id: form.board_id }); }}>Cancel edit</Button>}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Available classes</CardTitle>
            <CardDescription>Classes already mapped under the selected board.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {!form.board_id ? <p className="text-sm text-muted-foreground">Select a board to view linked classes.</p> : classes.length === 0 ? <p className="text-sm text-muted-foreground">No classes for this board yet.</p> : classes.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-4">
                  <div><p className="font-semibold">{item.name}</p><p className="text-sm text-muted-foreground">{item.code} • {item.slug}</p></div>
                  <div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => editClass(item)}>Edit</Button><Button type="button" size="sm" variant="outline" onClick={() => void toggleClass(item)}>{item.is_active ? "Archive" : "Reactivate"}</Button></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
