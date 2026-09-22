"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
// Use native textarea instead of a missing UI component
import { toast } from "@/hooks/use-toast";

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
      toast({ title: "Save failed", description: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-semibold">Admin Content Editor</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 max-w-3xl">
        <div>
          <Label>Type</Label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full px-3 py-2 glass-input">
            <option value="lesson">Lesson</option>
            <option value="blog">Blog</option>
            <option value="note">Note</option>
          </select>
        </div>

        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div>
          <Label>Slug (optional)</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
        </div>

        <div>
          <Label>Excerpt (optional)</Label>
          <Input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
        </div>

        <div>
          <Label>Content</Label>
          <textarea
            value={content}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
            rows={12}
            className="mt-1 block w-full px-3 py-2 glass-input"
          />
        </div>

        {(type === "lesson" || type === "note") && <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Topic ID</Label><Input value={topicId} onChange={(e) => setTopicId(e.target.value)} placeholder="UUID for the topic" /></div>
          <div><Label>Chapter ID</Label><Input value={chapterId} onChange={(e) => setChapterId(e.target.value)} placeholder="UUID for the chapter" /></div>
        </div>}

        <div>
          <Label>Status</Label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full px-3 py-2 glass-input">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
        </div>
      </form>
    </div>
  );
}
