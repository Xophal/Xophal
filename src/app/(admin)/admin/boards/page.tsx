"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type Board = {
  id: string;
  code: string;
  name: string;
  slug: string;
  description?: string | null;
  website_url?: string | null;
  is_active: boolean;
};

const blankBoard = {
  code: "",
  name: "",
  slug: "",
  description: "",
  website_url: "",
  is_active: true,
};

export default function AdminBoardsPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [form, setForm] = useState(blankBoard);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBoards();
  }, []);

  async function loadBoards() {
    const res = await fetch("/api/admin/boards", { cache: "no-store" });
    const json = await res.json();
    if (res.ok && json.success) setBoards(json.data || []);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(editingId ? `/api/admin/boards/${editingId}` : "/api/admin/boards", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, sort_order: editingId ? undefined : boards.length }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Could not create board");
      }

      toast({ title: editingId ? "Board updated" : "Board created", description: `${form.name} has been saved.` });
      setForm(blankBoard);
      setEditingId(null);
      await loadBoards();
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

  async function toggleBoard(board: Board) {
    const response = await fetch(`/api/admin/boards/${board.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: !board.is_active }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) return toast({ title: "Update failed", description: result.error || "Could not update board", variant: "destructive" });
    await loadBoards();
  }

  function editBoard(board: Board) {
    setEditingId(board.id);
    setForm({ code: board.code, name: board.name, slug: board.slug, description: board.description || "", website_url: board.website_url || "", is_active: board.is_active });
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Boards</h1>
        <p className="mt-2 text-sm text-muted-foreground">Create and manage the board taxonomy for your student catalog.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit board" : "Add board"}</CardTitle>
            <CardDescription>Register a new board such as CBSE, SEBA, or another state board.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="board-code">Code</Label>
                <Input id="board-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CBSE" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="board-name">Name</Label>
                <Input id="board-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Central Board of Secondary Education" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="board-slug">Slug</Label>
                <Input id="board-slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="cbse" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="board-description">Description</Label>
                <Input id="board-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Board description" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="board-url">Website</Label>
                <Input id="board-url" type="url" value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="https://example.com" />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Save board" : "Create board"}
              </Button>
              {editingId && <Button type="button" variant="ghost" className="w-full" onClick={() => { setEditingId(null); setForm(blankBoard); }}>Cancel edit</Button>}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Existing boards</CardTitle>
            <CardDescription>Board catalog currently available for student access.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {boards.length === 0 ? (
                <p className="text-sm text-muted-foreground">No boards added yet.</p>
              ) : (
                boards.map((board) => (
                  <div key={board.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{board.name}</p>
                        <p className="text-sm text-muted-foreground">{board.code} • /{board.slug}</p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        {board.is_active ? "Active" : "Inactive"}
                      </span>
                      <div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => editBoard(board)}>Edit</Button><Button type="button" size="sm" variant="outline" onClick={() => void toggleBoard(board)}>{board.is_active ? "Archive" : "Reactivate"}</Button></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
