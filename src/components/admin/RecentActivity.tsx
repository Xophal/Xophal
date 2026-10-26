"use client";

import React, { useEffect, useState } from "react";
import { FileEdit, UploadCloud } from "lucide-react";
import { AdminChip, AdminEmpty, AdminLoading } from "@/components/admin/ui";

type ActivityItem = {
  id?: string | number;
  title?: string;
  name?: string;
  filename?: string;
  type?: string;
  date?: string;
  created_at?: string;
  updated_at?: string;
};

async function fetchRecent(url: string): Promise<ActivityItem[]> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Could not load ${url}.`);
  }
  if (Array.isArray(json.data)) return json.data.slice(0, 6);
  if (Array.isArray(json.data?.data)) return json.data.data.slice(0, 6);
  throw new Error(`Unexpected response from ${url}.`);
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled([
        fetchRecent("/api/admin/imports"),
        fetchRecent("/api/admin/content"),
      ]);

      const merged: ActivityItem[] = [];
      const errors: string[] = [];
      const imports = results[0];
      const edits = results[1];
      if (imports.status === "fulfilled") {
        imports.value.forEach((it) =>
          merged.push({
            id: it.id,
            title: it.name || it.filename || `Import ${it.id}`,
            type: "import",
            date: it.created_at || it.updated_at,
          })
        );
      } else {
        errors.push(imports.reason instanceof Error ? imports.reason.message : "Could not load imports.");
      }
      if (edits.status === "fulfilled") {
        edits.value.forEach((it) =>
          merged.push({
            id: it.id,
            title: it.title || `Content ${it.id}`,
            type: "edit",
            date: it.updated_at || it.created_at,
          })
        );
      } else {
        errors.push(edits.reason instanceof Error ? edits.reason.message : "Could not load content activity.");
      }
      merged.sort((a, b) => {
        const da = a.date ? Date.parse(a.date) : 0;
        const db = b.date ? Date.parse(b.date) : 0;
        return db - da;
      });

      if (!cancelled) {
        setItems(merged.slice(0, 6));
        setError(errors.length > 0 ? errors.join(" ") : null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <AdminLoading label="Loading recent activity…" />;

  if (items.length === 0) {
    if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
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
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
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
