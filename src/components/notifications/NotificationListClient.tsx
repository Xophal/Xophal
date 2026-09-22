"use client";

import React, { useState } from "react";

export default function NotificationListClient({ initial = [] }: { initial?: any[] }) {
  const [items, setItems] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function markRead(id: string) {
    try {
      await fetch(`/api/notifications/mark-read`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      setItems((s) => s.map(i => i.id === id ? { ...i, is_read: true } : i));
    } catch (e) { console.error(e); }
  }

  async function markAll() {
    setLoading(true);
    try {
      await fetch(`/api/notifications/mark-all-read`, { method: "POST" });
      setItems((s) => s.map(i => ({ ...i, is_read: true })));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function del(id: string) {
    try {
      await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      setItems((s) => s.filter(i => i.id !== id));
    } catch (e) { console.error(e); }
  }

  if (!items || items.length === 0) return <div className="rounded-lg border p-6 text-sm text-muted-foreground">No notifications yet.</div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-end"><button disabled={loading} onClick={markAll} className="btn">Mark all read</button></div>
      <ol className="space-y-3">
        {items.map((n:any) => (
          <li key={n.id} className={`rounded-lg border p-4 ${n.is_read ? '' : 'bg-muted/5'}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{n.title}</div>
                <div className="text-sm text-muted-foreground mt-1">{n.message}</div>
                <div className="text-xs text-muted-foreground mt-2">{new Date(n.created_at).toLocaleString()}</div>
              </div>
              <div className="ml-4 flex flex-col gap-2">
                {!n.is_read && <button onClick={() => markRead(n.id)} className="text-sm">Mark read</button>}
                <button onClick={() => del(n.id)} className="text-sm text-destructive">Delete</button>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
