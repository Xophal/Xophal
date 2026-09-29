"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { AdminChip, AdminEmpty, AdminPage, AdminPageHeader, AdminPanel } from "@/components/admin/ui";

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
    <AdminPage>
      <AdminPageHeader
        eyebrow="Academics"
        title="Boards"
        description="Create and manage the board taxonomy for your student catalog."
        actions={<AdminChip tone="info">{boards.length} boards</AdminChip>}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <AdminPanel eyebrow="Editor" title={editingId ? "Edit board" : "Add board"} icon={editingId ? Pencil : Plus}>
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
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Save board" : "Create board"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(blankBoard); }}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </AdminPanel>

        <AdminPanel eyebrow="Catalogue" title="Existing boards" icon={School} flush>
          <div className="admin-panel-body">
            {boards.length === 0 ? (
              <AdminEmpty icon={School} title="No boards yet" hint="Register CBSE, SEBA or any state board to start building your catalog." />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Board</th>
                      <th>Slug</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boards.map((board) => (
                      <tr key={board.id}>
                        <td>
                          <p className="font-semibold text-white">{board.name}</p>
                          <p className="text-xs text-slate-500">{board.code}</p>
                        </td>
                        <td className="font-mono text-xs text-slate-400">/{board.slug}</td>
                        <td>
                          <AdminChip tone={board.is_active ? "success" : "neutral"}>{board.is_active ? "Active" : "Inactive"}</AdminChip>
                        </td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => editBoard(board)}>Edit</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => void toggleBoard(board)}>
                              {board.is_active ? "Archive" : "Reactivate"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </AdminPanel>
      </div>
    </AdminPage>
  );
}
