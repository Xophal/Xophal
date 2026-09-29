"use client";

import { useState } from "react";
import { FilePenLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { AdminChip, AdminPage, AdminPageHeader, AdminPanel } from "@/components/admin/ui";

const selectClass = "h-10 w-full rounded-md border border-white/10 bg-slate-950/50 px-3 text-sm text-white outline-none transition focus:border-cyan-400/50";
const textareaClass =
  "w-full rounded-md border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/50";

export default function AdminContentEditor() {
  const [type, setType] = useState("lesson");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [topicId, setTopicId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [status, setStatus] = useState("draft");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title, slug, excerpt, content, status, topicId: topicId || undefined, chapterId: chapterId || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save");
      toast({ title: "Saved", description: "Content created successfully." });
      setTitle("");
      setSlug("");
      setExcerpt("");
      setContent("");
      setTopicId("");
      setChapterId("");
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminPage className="mx-auto max-w-3xl">
      <AdminPageHeader
        eyebrow="Content"
        title="Content editor"
        description="Draft lessons, blog posts and revision notes, then publish them to the student catalogue."
        actions={<AdminChip tone={status === "published" ? "success" : "warning"}>{status}</AdminChip>}
      />

      <div className="mt-6">
        <AdminPanel eyebrow="Composer" title="New content" icon={FilePenLine}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="editor-type">Type</Label>
                <select id="editor-type" value={type} onChange={(e) => setType(e.target.value)} className={selectClass}>
                  <option value="lesson">Lesson</option>
                  <option value="blog">Blog</option>
                  <option value="note">Note</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editor-status">Status</Label>
                <select id="editor-status" value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editor-title">Title</Label>
              <Input id="editor-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Algebra essentials" required />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="editor-slug">Slug (optional)</Label>
                <Input id="editor-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="algebra-essentials" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editor-excerpt">Excerpt (optional)</Label>
                <Input id="editor-excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Short summary for listings" />
              </div>
            </div>

            {(type === "lesson" || type === "note") && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="editor-topic">Topic ID</Label>
                  <Input id="editor-topic" value={topicId} onChange={(e) => setTopicId(e.target.value)} placeholder="UUID for the topic" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editor-chapter">Chapter ID</Label>
                  <Input id="editor-chapter" value={chapterId} onChange={(e) => setChapterId(e.target.value)} placeholder="UUID for the chapter" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="editor-content">Content</Label>
              <textarea id="editor-content" value={content} onChange={(e) => setContent(e.target.value)} rows={12} className={textareaClass} placeholder="Write the lesson body here…" required />
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? "Saving…" : "Save content"}
              </Button>
              <span className="text-xs text-slate-500">Published content is immediately visible to students.</span>
            </div>
          </form>
        </AdminPanel>
      </div>
    </AdminPage>
  );
}
