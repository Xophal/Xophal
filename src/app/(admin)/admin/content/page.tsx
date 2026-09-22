"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const modules = [
  { title: "Boards & Classes", description: "Manage board and class taxonomy", href: "/admin/boards" },
  { title: "Subjects & Chapters", description: "Organize the subject and chapter tree", href: "/admin/chapters" },
  { title: "Questions & Tests", description: "Create and publish question banks and mock tests", href: "/admin/questions" },
  { title: "Blogs & Announcements", description: "Publish updates and learning content", href: "/admin/blogs" },
];

const defaultForm = {
  type: "blog",
  title: "",
  slug: "",
  excerpt: "",
  category: "",
  tags: "",
  content: "",
  status: "draft",
};

export default function AdminContentPage() {
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [submittedItems, setSubmittedItems] = useState<Array<{ id: string; type: string; title: string; status: string; createdAt: string }>>([
    { id: "seed-1", type: "blog", title: "JEE Main 2026 strategy update", status: "draft", createdAt: "Today" },
    { id: "seed-2", type: "lesson", title: "Algebra essentials", status: "review", createdAt: "This week" },
  ]);

  const totalDrafts = useMemo(
    () => submittedItems.filter((item) => item.status === "draft").length,
    [submittedItems]
  );

  const handleChange = (field: keyof typeof defaultForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: "Missing content", description: "Add a title and body before saving the draft." });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          slug: form.slug || form.title,
          tags: form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to save content.");
      }

      const record = result.data?.record ?? {
        id: `preview-${Date.now()}`,
        type: form.type,
        title: form.title,
        status: form.status,
        createdAt: "Just now",
      };

      setSubmittedItems((current) => [{
        id: record.id,
        type: record.type,
        title: record.title,
        status: record.status,
        createdAt: record.createdAt || "Just now",
      }, ...current]);
      setForm(defaultForm);
      toast({
        title: "Content saved",
        description: `The ${form.type} draft was queued for beta review.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      toast({ title: "Save failed", description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Content management</h1>
          <p className="mt-2 text-sm text-muted-foreground">A working content hub for managing the educational catalog without code changes.</p>
        </div>
        <Button asChild>
          <Link href="/admin/subjects">Open subject manager</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {modules.map((module) => (
          <Card key={module.title}>
            <CardHeader>
              <CardTitle>{module.title}</CardTitle>
              <CardDescription>{module.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={module.href} className="text-sm font-medium text-primary">
                Open module →
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Publish new content</CardTitle>
            <CardDescription>Upload a draft or live post directly from the frontend for beta testing.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">
                  Content type
                  <select
                    value={form.type}
                    onChange={(event) => handleChange("type", event.target.value)}
                    className="w-full px-3 py-2 text-sm glass-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="blog">Blog</option>
                    <option value="lesson">Lesson</option>
                    <option value="note">Note</option>
                    <option value="faq">FAQ</option>
                    <option value="announcement">Announcement</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Status
                  <select
                    value={form.status}
                    onChange={(event) => handleChange("status", event.target.value)}
                    className="w-full px-3 py-2 text-sm glass-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="draft">Draft</option>
                    <option value="review">Under review</option>
                    <option value="approved">Approved</option>
                    <option value="published">Published</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-2 text-sm font-medium">
                Title
                <input
                  value={form.title}
                  onChange={(event) => handleChange("title", event.target.value)}
                  placeholder="e.g. CBSE Maths practice tips"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2 text-sm font-medium">
                  Slug
                  <input
                    value={form.slug}
                    onChange={(event) => handleChange("slug", event.target.value)}
                    placeholder="cbse-maths-practice-tips"
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                </label>

                <label className="block space-y-2 text-sm font-medium">
                  Category
                  <input
                    value={form.category}
                    onChange={(event) => handleChange("category", event.target.value)}
                    placeholder="Board prep, school updates..."
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                </label>
              </div>

              <label className="block space-y-2 text-sm font-medium">
                Excerpt
                <textarea
                  value={form.excerpt}
                  onChange={(event) => handleChange("excerpt", event.target.value)}
                  rows={3}
                  placeholder="Short summary for the listing page"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <label className="block space-y-2 text-sm font-medium">
                Tags
                <input
                  value={form.tags}
                  onChange={(event) => handleChange("tags", event.target.value)}
                  placeholder="jee, maths, revision"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <label className="block space-y-2 text-sm font-medium">
                Content body
                <textarea
                  value={form.content}
                  onChange={(event) => handleChange("content", event.target.value)}
                  rows={8}
                  placeholder="Write the article, lesson notes, or announcement copy here..."
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : "Save content"}
                </Button>
                <span className="text-xs text-slate-500">Beta mode: content is saved immediately in the app flow.</span>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent beta uploads</CardTitle>
            <CardDescription>{totalDrafts} drafts currently waiting for review.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {submittedItems.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                      {item.type}
                    </span>
                    <span className="text-xs text-slate-500">{item.createdAt}</span>
                  </div>
                  <p className="mt-2 font-medium text-slate-900">{item.title}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>Status: {item.status}</span>
                    <span>Ready</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
