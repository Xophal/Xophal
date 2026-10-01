"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Newspaper, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminChip, AdminEmpty, AdminLoading, AdminPage, AdminPageHeader, AdminPanel, AdminPagination, AdminToolbar, readList } from "@/components/admin/ui";
import { createBlogSlug } from "@/lib/blog-content";

type Blog = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string | null;
  featured_image_url?: string | null;
  tags?: string[] | null;
  is_published: boolean;
  published_at?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  created_at: string;
  profiles?: { full_name?: string | null; email?: string | null } | null;
};

const blank = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  featured_image_url: "",
  tags: "",
  is_published: false,
  meta_title: "",
  meta_description: "",
};

export default function AdminBlogsPage() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [editingLoading, setEditingLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const limit = 10;

  useEffect(() => {
    load(page, query, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query, status]);

  async function load(current: number, q: string, currentStatus = status) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(current), limit: String(limit) });
      if (q) params.set("q", q);
      if (currentStatus !== "all") params.set("published", currentStatus);
      const res = await fetch(`/api/admin/blogs?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load blogs");
      const parsed = readList<Blog>(json);
      setBlogs(parsed.items);
      setTotal(parsed.total);
    } catch (error) {
      toast({ title: "Load failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  async function editBlog(blog: Blog) {
    setEditingLoading(true);
    try {
      const response = await fetch(`/api/admin/blogs/${blog.id}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not load this post");
      const fullPost = json.data as Blog;
      setEditingId(fullPost.id);
      setSlugTouched(true);
      setForm({
        title: fullPost.title,
        slug: fullPost.slug,
        excerpt: fullPost.excerpt || "",
        content: fullPost.content || "",
        featured_image_url: fullPost.featured_image_url || "",
        tags: (fullPost.tags || []).join(", "),
        is_published: fullPost.is_published,
        meta_title: fullPost.meta_title || "",
        meta_description: fullPost.meta_description || "",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast({ title: "Could not open post", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setEditingLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt,
        content: form.content,
        featured_image_url: form.featured_image_url,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        is_published: form.is_published,
        meta_title: form.meta_title,
        meta_description: form.meta_description,
      };
      const res = await fetch(editingId ? `/api/admin/blogs/${editingId}` : "/api/admin/blogs", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not save post");
      toast({ title: editingId ? "Post updated" : "Post created", description: `${form.title} has been saved.` });
      setForm(blank);
      setEditingId(null);
      setSlugTouched(false);
      await load(page, query);
    } catch (error) {
      toast({ title: "Save failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(blog: Blog) {
    const res = await fetch(`/api/admin/blogs/${blog.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_published: !blog.is_published }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) return toast({ title: "Update failed", description: json.error || "Could not update post", variant: "destructive" });
    toast({ title: blog.is_published ? "Post unpublished" : "Post published", description: blog.title });
    await load(page, query);
  }

  async function deleteBlog(blog: Blog) {
    if (!window.confirm(`Delete "${blog.title}"? This cannot be undone.`)) return;
    const response = await fetch(`/api/admin/blogs/${blog.id}`, { method: "DELETE" });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.success) {
      toast({ title: "Delete failed", description: json.error || "Could not delete post", variant: "destructive" });
      return;
    }
    if (editingId === blog.id) {
      setEditingId(null);
      setForm(blank);
      setSlugTouched(false);
    }
    toast({ title: "Post deleted", description: blog.title });
    await load(page, query);
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Content"
        title="Blogs"
        description="Write, optimize and publish SEO articles that drive organic traffic to the platform."
        actions={<AdminChip tone="info">{total} posts</AdminChip>}
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <AdminPanel eyebrow="Editor" title={editingId ? "Edit post" : "New post"} icon={editingId ? Pencil : Plus}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="blog-title">Title</Label>
              <Input id="blog-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: slugTouched ? form.slug : createBlogSlug(e.target.value) })} placeholder="10 study habits that actually work" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="blog-slug">Slug</Label>
                <Input id="blog-slug" value={form.slug} onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: e.target.value }); }} placeholder="study-habits-that-work" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blog-image">Featured image URL</Label>
                <Input id="blog-image" type="url" value={form.featured_image_url} onChange={(e) => setForm({ ...form, featured_image_url: e.target.value })} placeholder="https://…" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="blog-excerpt">Excerpt</Label>
              <textarea
                id="blog-excerpt"
                rows={2}
                value={form.excerpt}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Short summary shown in listings and meta description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blog-content">Content (HTML or Markdown)</Label>
              <textarea
                id="blog-content"
                rows={8}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="# Article heading\n\nWrite your article in Markdown."
              />
              <p className="text-xs text-muted-foreground">Markdown supported. Raw HTML is sanitized before publication.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="blog-tags">Tags</Label>
                <Input id="blog-tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="study-tips, exams" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blog-meta">Meta title</Label>
                <Input id="blog-meta" value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} placeholder="SEO title" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="blog-meta-desc">Meta description</Label>
              <Input
                id="blog-meta-desc"
                value={form.meta_description}
                onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
                placeholder="SEO description"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
              Publish immediately
            </label>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save post" : "Create post"}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setForm(blank);
                    setSlugTouched(false);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </AdminPanel>

        <AdminPanel eyebrow="Library" title="All posts" icon={Newspaper} flush>
          <div className="px-5 pt-5">
            <AdminToolbar>
              <form onSubmit={onSearch} className="admin-toolbar-grow flex gap-2">
                <Input placeholder="Search title or slug" value={search} onChange={(e) => setSearch(e.target.value)} />
                <Button type="submit" variant="outline" size="sm">
                  <Search className="h-4 w-4" /> Search
                </Button>
              </form>
              <select
                aria-label="Filter posts by status"
                value={status}
                onChange={(event) => { setPage(1); setStatus(event.target.value); }}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="true">Published</option>
                <option value="false">Drafts</option>
              </select>
            </AdminToolbar>
          </div>

          <div className="admin-panel-body mt-4">
            {loading ? (
              <AdminLoading label="Loading posts…" />
            ) : blogs.length === 0 ? (
              <AdminEmpty icon={Newspaper} title="No posts yet" hint={query ? "No posts match your search." : "Create your first article with the editor."} />
            ) : (
              <>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Post</th>
                        <th>Author</th>
                        <th>Status</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blogs.map((blog) => (
                        <tr key={blog.id}>
                          <td>
                            <p className="font-semibold text-white">{blog.title}</p>
                            <p className="text-xs text-slate-500">/{blog.slug}</p>
                          </td>
                          <td className="text-slate-400">{blog.profiles?.full_name || blog.profiles?.email || "—"}</td>
                          <td>
                            <AdminChip tone={blog.is_published ? "success" : "warning"}>{blog.is_published ? "Published" : "Draft"}</AdminChip>
                          </td>
                          <td>
                            <div className="flex justify-end gap-2">
                              <Button type="button" size="sm" variant="outline" disabled={editingLoading} onClick={() => void editBlog(blog)}>
                                <Pencil className="h-4 w-4" /> Edit
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => void togglePublished(blog)}>
                                {blog.is_published ? "Unpublish" : "Publish"}
                              </Button>
                              {blog.is_published && (
                                <Link href={`/blog/${blog.slug}`} target="_blank" rel="noreferrer" aria-label={`Preview ${blog.title}`} title="Preview published post" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input text-sm hover:bg-accent hover:text-accent-foreground">
                                  <ExternalLink className="h-4 w-4" />
                                </Link>
                              )}
                              <Button type="button" size="sm" variant="outline" aria-label={`Delete ${blog.title}`} title="Delete post" onClick={() => void deleteBlog(blog)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <AdminPagination page={page} total={total} limit={limit} onPage={setPage} busy={loading} />
              </>
            )}
          </div>
        </AdminPanel>
      </div>
    </AdminPage>
  );
}
