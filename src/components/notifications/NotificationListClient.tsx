"use client";

import React, { useState } from "react";
import Link from "next/link";
import { toast } from "@/hooks/use-toast";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationListClient({ initial = [] }: { initial?: NotificationItem[] }) {
  const [items, setItems] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function markRead(id: string) {
    try {
      const response = await fetch(`/api/notifications/mark-read`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not update notification.");
      setItems((s) => s.map(i => i.id === id ? { ...i, is_read: true } : i));
    } catch (error) {
      toast({ title: "Update failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  }

  async function markAll() {
    setLoading(true);
    try {
      const response = await fetch(`/api/notifications/mark-all-read`, { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not update notifications.");
      setItems((s) => s.map(i => ({ ...i, is_read: true })));
    } catch (error) {
      toast({ title: "Update failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function del(id: string) {
    try {
      const response = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not dismiss notification.");
      setItems((s) => s.filter(i => i.id !== id));
    } catch (error) {
      toast({ title: "Dismiss failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  }

  if (!items || items.length === 0) return <div className="rounded-lg border p-6 text-sm text-muted-foreground">No notifications yet.</div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-end"><button disabled={loading} onClick={markAll} className="btn">Mark all read</button></div>
      <ol className="space-y-3">
        {items.map((n) => (
          <li key={n.id} className={`rounded-lg border p-4 ${n.is_read ? '' : 'bg-muted/5'}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">
                  {n.link_url ? <Link href={n.link_url} onClick={() => { if (!n.is_read) void markRead(n.id); }} className="hover:underline">{n.title}</Link> : n.title}
                </div>
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
