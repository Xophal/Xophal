"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?limit=5`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.success) {
        setItems((json.data?.data || json.data?.items || []) as NotificationItem[]);
        setUnread(json.data?.pagination?.extra?.unread ?? json.data?.unread ?? null);
      }
    } catch {
      // ignore
    } finally { setLoading(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const interval = window.setInterval(() => { void load(); }, 60_000);
    const onFocus = () => { void load(); };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function markRead(id: string) {
    try {
      const response = await fetch(`/api/notifications/mark-read`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const result = await response.json();
      if (!response.ok || !result.success) return;
      setItems((s) => s.map(i => i.id === id ? { ...i, is_read: true } : i));
      setUnread((u) => (u !== null ? Math.max(0, u - 1) : u));
    } catch {}
  }

  async function markAll() {
    try {
      const response = await fetch(`/api/notifications/mark-all-read`, { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.success) return;
      setItems((s) => s.map(i => ({ ...i, is_read: true })));
      setUnread(0);
    } catch {}
  }

  return (
    <div className="relative" ref={rootRef}>
      <button type="button" aria-label="Notifications" aria-expanded={open} onClick={() => setOpen(o => !o)} className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/70 text-slate-600 hover:border-emerald-300 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread ? <span aria-label={`${unread} unread notifications`} className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] text-white">{unread > 99 ? "99+" : unread}</span> : null}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border bg-card shadow-lg">
          <div className="flex items-center justify-between p-3"><div className="text-sm font-semibold">Notifications</div><button type="button" onClick={markAll} disabled={!unread || loading} className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50">Mark all read</button></div>
          <div className="max-h-64 overflow-auto">
            {loading ? <div className="p-4 text-sm text-muted-foreground">Loading…</div> : items.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No notifications</div> : (
              items.map(item => (
                <div key={item.id} className={`p-3 border-t ${item.is_read ? 'bg-transparent' : 'bg-muted/5'}`}>
                  <Link href={item.link_url || '/notifications'} className="block" onClick={() => item.is_read ? null : markRead(item.id)}>
                    <div className="text-sm font-medium">{item.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground truncate">{item.message}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</div>
                  </Link>
                </div>
              ))
            )}
          </div>
          <div className="p-3 border-t"><Link href="/notifications" className="text-sm font-medium">View all notifications</Link></div>
        </div>
      )}
    </div>
  );
}
