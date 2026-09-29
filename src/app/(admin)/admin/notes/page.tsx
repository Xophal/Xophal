"use client";

import { useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { AdminChip, AdminEmpty, AdminPage, AdminPageHeader, AdminPanel } from "@/components/admin/ui";

type Note = {
  id: string;
  title: string;
  slug: string;
  content: string;
  is_premium: boolean;
  is_active: boolean;
};

const blankNote = {
  title: "",
  slug: "",
  content: "",
  is_premium: false,
  is_active: true,
};

export default function AdminNotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [form, setForm] = useState(blankNote);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadNotes();
  }, []);

  async function loadNotes() {
    const res = await fetch("/api/admin/notes", { cache: "no-store" });
    const json = await res.json();
    if (res.ok && json.success) setNotes(json.data || []);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/admin/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, sort_order: notes.length }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Could not create note");
      }

      toast({ title: "Note created", description: `${form.title} has been published.` });
      setForm(blankNote);
      await loadNotes();
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

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Content"
        title="Notes"
        description="Publish revision notes for subjects and chapters to support student learning."
        actions={<AdminChip tone="info">{notes.length} notes</AdminChip>}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <AdminPanel eyebrow="Editor" title="Add note" icon={Plus}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="note-title">Title</Label>
              <Input id="note-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Algebra formula sheet" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-slug">Slug</Label>
              <Input id="note-slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="algebra-formula-sheet" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-content">Content</Label>
              <textarea id="note-content" rows={8} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Write the revision content here" required />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_premium} onChange={(e) => setForm({ ...form, is_premium: e.target.checked })} />
              Premium note
            </label>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Saving..." : "Create note"}
            </Button>
          </form>
        </AdminPanel>

        <AdminPanel eyebrow="Catalogue" title="Published notes" icon={FileText} flush>
          <div className="admin-panel-body">
            {notes.length === 0 ? (
              <AdminEmpty icon={FileText} title="No notes yet" hint="Create your first revision note with the editor." />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Note</th>
                      <th>Tier</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notes.map((note) => (
                      <tr key={note.id}>
                        <td>
                          <p className="font-semibold text-white">{note.title}</p>
                          <p className="text-xs text-slate-500">/{note.slug}</p>
                        </td>
                        <td>
                          <AdminChip tone={note.is_premium ? "violet" : "info"}>{note.is_premium ? "Premium" : "Free"}</AdminChip>
                        </td>
                        <td>
                          <AdminChip tone={note.is_active ? "success" : "neutral"}>{note.is_active ? "Active" : "Hidden"}</AdminChip>
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
