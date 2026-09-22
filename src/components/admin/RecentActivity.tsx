"use server";

import React from "react";

type ActivityItem = { id?: string | number; title?: string; type?: string; date?: string };

async function fetchRecent(url: string) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    if (Array.isArray(json)) return json.slice(0, 6);
    if (json?.data && Array.isArray(json.data)) return json.data.slice(0, 6);
    return [];
  } catch (e) {
    return [];
  }
}

export default async function RecentActivity() {
  const [imports, edits] = await Promise.all([
    fetchRecent("/api/admin/imports"),
    fetchRecent("/api/admin/content"),
  ]);

  const items: ActivityItem[] = [];

  imports.forEach((it: any) => items.push({ id: it.id, title: it.name || it.filename || `Import ${it.id}`, type: "import", date: it.created_at || it.updated_at }));
  edits.forEach((it: any) => items.push({ id: it.id, title: it.title || `Content ${it.id}`, type: "edit", date: it.updated_at || it.created_at }));

  items.sort((a, b) => {
    const da = a.date ? Date.parse(a.date) : 0;
    const db = b.date ? Date.parse(b.date) : 0;
    return db - da;
  });

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold">Recent activity</h3>
      <ul className="mt-3 flex flex-col gap-2">
        {items.slice(0, 6).map((it) => (
          <li key={String(it.id)} className="flex items-start justify-between">
            <div>
              <div className="text-sm font-medium text-slate-900">{it.title}</div>
              <div className="text-xs text-muted-foreground">{it.type} {it.date ? `· ${new Date(it.date).toLocaleString()}` : ""}</div>
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-muted-foreground">No recent activity</li>}
      </ul>
    </div>
  );
}
