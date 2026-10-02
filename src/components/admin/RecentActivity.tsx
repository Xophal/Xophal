"use client";

import React, { useEffect, useState } from "react";
import { FileEdit, UploadCloud } from "lucide-react";
import { AdminChip, AdminEmpty, AdminLoading } from "@/components/admin/ui";

type ActivityItem = {
  id?: string | number;
  title?: string;
  type?: string;
  date?: string;
};

async function fetchRecent(url: string): Promise<ActivityItem[]> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    if (Array.isArray(json)) return json.slice(0, 6);
    if (Array.isArray(json?.data)) return json.data.slice(0, 6);
    return [];
  } catch {
    return [];
  }
}

function formatWhen(date?: string) {
  if (!date) return "";
  const parsed = Date.parse(date);
  if (Number.isNaN(parsed)) return "";
  const diffMs = Date.now() - parsed;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(parsed).toLocaleDateString();
}

export default function RecentActivity() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [imports, edits] = await Promise.all([
        fetchRecent("/api/admin/imports"),
        fetchRecent("/api/admin/content"),
      ]);

      const merged: ActivityItem[] = [];
      imports.forEach((it: ActivityItem & { name?: string; filename?: string; created_at?: string; updated_at?: string }) =>
        merged.push({ id: it.id, title: it.name || it.filename || `Import ${it.id}`, type: "import", date: it.created_at || it.updated_at })
      );
      edits.forEach((it: ActivityItem & { updated_at?: string; created_at?: string }) =>
        merged.push({ id: it.id, title: it.title || `Content ${it.id}`, type: "edit", date: it.updated_at || it.created_at })
      );
      merged.sort((a, b) => {
        const da = a.date ? Date.parse(a.date) : 0;
        const db = b.date ? Date.parse(b.date) : 0;
        return db - da;
      });

      if (!cancelled) {
        setItems(merged.slice(0, 6));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <AdminLoading label="Loading recent activity…" />;

  if (items.length === 0) {
    return (
      <AdminEmpty
        icon={UploadCloud}
        title="No activity yet"
        hint="Imports and content edits will appear here as your team works through the pipeline."
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((it, index) => (
        <div key={String(it.id ?? index)} className="admin-row">
          <div className="flex min-w-0 items-center gap-3">
            <span className="admin-stat-icon" style={{ width: "2.4rem", height: "2.4rem" }}>
              {it.type === "import" ? (
                <UploadCloud className="h-4 w-4" aria-hidden />
              ) : (
                <FileEdit className="h-4 w-4" aria-hidden />
              )}
            </span>
            <div className="min-w-0">
              <p className="admin-row-title truncate">{it.title || `Activity ${index + 1}`}</p>
              <p className="admin-row-meta">{formatWhen(it.date) || "Timestamp unavailable"}</p>
            </div>
          </div>
          <AdminChip tone={it.type === "import" ? "info" : "violet"}>{it.type === "import" ? "Import" : "Content"}</AdminChip>
        </div>
      ))}
    </div>
  );
}

