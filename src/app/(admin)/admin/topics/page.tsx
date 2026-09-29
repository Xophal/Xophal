"use client";

import { useEffect, useMemo, useState } from "react";
import { Boxes, Pencil, Plus, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminChip, AdminEmpty, AdminLoading, AdminPage, AdminPageHeader, AdminPanel, AdminToolbar } from "@/components/admin/ui";

type Topic = {
  id: string;
  chapter_id: string;
  code: string;
  name: string;
  slug: string;
  description?: string | null;
  is_active: boolean;
  sort_order: number;
};

type Chapter = { id: string; name: string; code: string };

const blank = { chapter_id: "", code: "", name: "", slug: "", description: "", is_active: true };

export default function AdminTopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [topicsRes, chaptersRes] = await Promise.all([
        fetch("/api/admin/topics", { cache: "no-store" }),
        fetch("/api/admin/chapters", { cache: "no-store" }),
      ]);
      const topicsJson = await topicsRes.json().catch(() => ({}));
      const chaptersJson = await chaptersRes.json().catch(() => ({}));
      if (topicsRes.ok && topicsJson.success) setTopics(topicsJson.data || []);
      if (chaptersRes.ok && chaptersJson.success) setChapters(chaptersJson.data || []);
      setLoading(false);
    })();
  }, []);

  const chapterName = useMemo(() => {
    const map = new Map(chapters.map((c) => [c.id, c.name]));
    return (id: string) => map.get(id) || "Unknown chapter";
  }, [chapters]);

  const filtered = topics.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q) || chapterName(t.chapter_id).toLowerCase().includes(q);
  });

  async function reload() {
    const res = await fetch("/api/admin/topics", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) setTopics(json.data || []);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(editingId ? `/api/admin/topics/${editingId}` : "/api/admin/topics", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, sort_order: editingId ? undefined : topics.length }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not save topic");
      toast({ title: editingId ? "Topic updated" : "Topic created", description: `${form.name} has been saved.` });
      setForm(blank);
      setEditingId(null);
      await reload();
    } catch (error) {
      toast({ title: "Save failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleTopic(topic: Topic) {
    const res = await fetch(`/api/admin/topics/${topic.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !topic.is_active }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) return toast({ title: "Update failed", description: json.error || "Could not update topic", variant: "destructive" });
    setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, is_active: !topic.is_active } : t)));
  }

  function editTopic(topic: Topic) {
    setEditingId(topic.id);
    setForm({
      chapter_id: topic.chapter_id,
      code: topic.code,
      name: topic.name,
      slug: topic.slug,
      description: topic.description || "",
      is_active: topic.is_active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Academics"
        title="Topics"
        description="Maintain the topic layer beneath every chapter so notes, questions and progress tracking stay aligned."
        actions={
          <AdminChip tone="info">
            {topics.length} topics · {chapters.length} chapters
          </AdminChip>
        }
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <AdminPanel eyebrow="Editor" title={editingId ? "Edit topic" : "Add topic"} icon={editingId ? Pencil : Plus}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic-chapter">Chapter</Label>
              <select
                id="topic-chapter"
                className="flex h-10 w-full rounded-md px-3 py-2 text-sm"
                value={form.chapter_id}
                onChange={(e) => setForm({ ...form, chapter_id: e.target.value })}
                required
              >
                <option value="">Select a chapter…</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name} ({chapter.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="topic-code">Code</Label>
                <Input id="topic-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="T1" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="topic-slug">Slug</Label>
                <Input id="topic-slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="quadratic-equations" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic-name">Name</Label>
              <Input id="topic-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Quadratic Equations" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic-description">Description</Label>
              <textarea
                id="topic-description"
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="What does this topic cover?"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Active and visible to students
            </label>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save topic" : "Create topic"}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setForm(blank);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </AdminPanel>

        <AdminPanel eyebrow="Catalogue" title="All topics" icon={Boxes} flush>
          <div className="px-5 pt-5">
            <AdminToolbar>
              <div className="admin-toolbar-grow relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
                <Input className="pl-9" placeholder="Search topics or chapters" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </AdminToolbar>
          </div>

          <div className="admin-panel-body mt-4">
            {loading ? (
              <AdminLoading label="Loading topics…" />
            ) : filtered.length === 0 ? (
              <AdminEmpty icon={Boxes} title="No topics found" hint={search ? "No topics match your search." : "Create your first topic using the editor."} />
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Topic</th>
                      <th>Chapter</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((topic) => (
                      <tr key={topic.id}>
                        <td>
                          <p className="font-semibold text-white">{topic.name}</p>
                          <p className="text-xs text-slate-500">
                            {topic.code} · /{topic.slug}
                          </p>
                        </td>
                        <td className="text-slate-400">{chapterName(topic.chapter_id)}</td>
                        <td>
                          <AdminChip tone={topic.is_active ? "success" : "neutral"}>{topic.is_active ? "Active" : "Hidden"}</AdminChip>
                        </td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => editTopic(topic)}>
                              Edit
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => void toggleTopic(topic)}>
                              {topic.is_active ? "Hide" : "Show"}
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
