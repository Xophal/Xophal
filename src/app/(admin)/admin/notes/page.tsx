"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

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
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold">Notes</h1>
        <p className="mt-2 text-sm text-muted-foreground">Publish revision notes for subjects and chapters to support student learning.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Add note</CardTitle>
            <CardDescription>Create a study note that can be surfaced in the student notes section.</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Published notes</CardTitle>
            <CardDescription>Resource list currently available in the backend catalog.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {notes.length === 0 ? <p className="text-sm text-muted-foreground">No notes created yet.</p> : notes.map((note) => (
                <div key={note.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{note.title}</p>
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                      {note.is_premium ? "Premium" : "Free"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">/{note.slug}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
