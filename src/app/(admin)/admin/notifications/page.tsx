"use client";

import { useEffect, useState } from "react";
import { BellRing, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AdminChip,
  AdminEmpty,
  AdminLoading,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  AdminPagination,
  readList,
} from "@/components/admin/ui";

type SentNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  link_url: string | null;
  is_global: boolean;
  is_read: boolean;
  created_at: string;
  profiles?: { full_name?: string | null; email?: string | null } | null;
};

const blank = { title: "", message: "", type: "info", link_url: "", is_global: true, user_ids: "" };

const TYPE_TONES: Record<string, "info" | "success" | "warning" | "violet" | "neutral"> = {
  info: "info",
  success: "success",
  warning: "warning",
  announcement: "violet",
};

export default function AdminNotificationsPage() {
  const [form, setForm] = useState(blank);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<SentNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 10;

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function load(current: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/notifications?page=${current}&limit=${limit}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed to load notifications");
      const { items, total: count } = readList<SentNotification>(json);
      setHistory(items);
      setTotal(count);
    } catch (error) {
      toast({ title: "Load failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    try {
      const userIds = form.user_ids
        .split(/[,\s]+/)
        .map((v) => v.trim())
        .filter(Boolean);

      if (form.is_global === false && userIds.length === 0) {
        throw new Error("Add at least one recipient or switch to a global broadcast.");
      }

      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          message: form.message,
          type: form.type,
          link_url: form.link_url || null,
          is_global: form.is_global,
          user_ids: form.is_global ? [] : userIds,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not send notification");
      toast({ title: "Notification sent", description: `${json.data?.created ?? 1} notification(s) queued for delivery.` });
      setForm(blank);
      setPage(1);
      await load(1);
    } catch (error) {
      toast({ title: "Send failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Engagement"
        title="Notifications"
        description="Broadcast announcements to every student or target specific accounts with in-app notifications."
        actions={<AdminChip tone="info">{total} sent</AdminChip>}
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <AdminPanel eyebrow="Composer" title="New notification" icon={Send}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notif-title">Title</Label>
              <Input id="notif-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Mock test season is live" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notif-message">Message</Label>
              <textarea
                id="notif-message"
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Write a short, actionable message for students…"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="notif-type">Type</Label>
                <select
                  id="notif-type"
                  className="flex h-10 w-full rounded-md px-3 py-2 text-sm"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                  <option value="warning">Warning</option>
                  <option value="announcement">Announcement</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notif-link">Link (optional)</Label>
                <Input id="notif-link" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="/dashboard" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_global} onChange={(e) => setForm({ ...form, is_global: e.target.checked })} />
              Global broadcast (all students)
            </label>

            {!form.is_global && (
              <div className="space-y-2">
                <Label htmlFor="notif-users">Recipient user IDs</Label>
                <Input
                  id="notif-users"
                  value={form.user_ids}
                  onChange={(e) => setForm({ ...form, user_ids: e.target.value })}
                  placeholder="uuid-1, uuid-2"
                />
                <p className="text-xs text-slate-500">Paste comma or space separated profile IDs for targeted delivery.</p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={sending}>
              {sending ? "Sending…" : "Send notification"}
            </Button>
          </form>
        </AdminPanel>

        <AdminPanel eyebrow="History" title="Recently sent" icon={BellRing} flush>
          <div className="admin-panel-body">
            {loading ? (
              <AdminLoading label="Loading history…" />
            ) : history.length === 0 ? (
              <AdminEmpty icon={BellRing} title="Nothing sent yet" hint="Notifications you send will appear here with their delivery scope." />
            ) : (
              <>
                <div className="space-y-3">
                  {history.map((item) => (
                    <div key={item.id} className="admin-row">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="admin-stat-icon admin-stat-icon--cyan">
                          <BellRing className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="admin-row-title">{item.title}</p>
                          <p className="admin-row-meta line-clamp-2">{item.message}</p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {new Date(item.created_at).toLocaleString()}
                            {item.profiles?.email ? ` · to ${item.profiles.email}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <AdminChip tone={item.is_global ? "info" : "violet"}>{item.is_global ? "Global" : "Targeted"}</AdminChip>
                        <AdminChip tone={TYPE_TONES[item.type] || "neutral"}>{item.type}</AdminChip>
                      </div>
                    </div>
                  ))}
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
