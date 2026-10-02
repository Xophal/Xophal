"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Trophy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AdminChip, AdminEmpty, AdminLoading, AdminPage, AdminPageHeader, AdminPanel, AdminToolbar } from "@/components/admin/ui";

function formatTime(seconds: number | null) { if (!seconds && seconds !== 0) return "—"; return `${Math.floor((seconds||0)/60)}m ${(seconds||0)%60}s`; }

const STATUS_TONES: Record<string, "success" | "warning" | "info" | "neutral"> = {
  submitted: "success",
  completed: "success",
  expired: "warning",
  in_progress: "info",
  pending: "neutral",
};

type AttemptRow = {
  id: string;
  user_id: string;
  status: string;
  submitted_at: string | null;
  time_spent_seconds: number | null;
  marks_obtained: number | null;
  total_marks: number | null;
  percentage: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  skipped_count: number | null;
  profiles: { full_name: string | null; email: string | null } | null;
  mock_tests: { title: string } | null;
};

export default function AdminResultsPage() {
  const [result, setResult] = useState<{ query: string; page: number; items: AttemptRow[]; total: number } | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const loading = result?.query !== q || result.page !== page;
  const items = result?.query === q && result.page === page ? result.items : [];
  const total = result?.query === q && result.page === page ? result.total : 0;

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/results?page=${page}&limit=20&q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || "Could not load results");
        if (active) setResult({ query: q, page, items: json.data.items ?? [], total: json.data.total ?? 0 });
      } catch {
        if (active) setResult({ query: q, page, items: [], total: 0 });
      }
    })();
    return () => { active = false; };
  }, [page, q]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setQ(search);
    setPage(1);
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Assessments"
        title="Results"
        description="Audit every mock test attempt with scores, accuracy and submission detail."
        actions={<AdminChip tone="info">{total} attempts</AdminChip>}
      />

      <div className="mt-6">
        <AdminPanel eyebrow="Ledger" title="Attempt results" icon={Trophy} flush>
          <div className="px-5 pt-5">
            <AdminToolbar>
              <form onSubmit={onSearch} className="admin-toolbar-grow flex gap-2">
                <Input placeholder="Search by student or test" value={search} onChange={(e) => setSearch(e.target.value)} />
                <Button type="submit" variant="outline" size="sm"><Search className="h-4 w-4" /> Search</Button>
              </form>
            </AdminToolbar>
          </div>

          <div className="admin-panel-body mt-4">
            {loading ? (
              <AdminLoading label="Loading results…" />
            ) : items.length === 0 ? (
              <AdminEmpty icon={Trophy} title="No results" hint={q ? "No attempts match your search." : "Completed attempts will appear here once students submit tests."} />
            ) : (
              <>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Test</th>
                        <th className="text-right">Score</th>
                        <th className="text-right">%</th>
                        <th className="text-right">C / W / S</th>
                        <th>Status</th>
                        <th>Submitted</th>
                        <th className="text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.id}>
                          <td><Link href={`/admin/results/${it.id}`}>{it.profiles?.full_name || it.profiles?.email || "User"}</Link></td>
                          <td className="text-slate-300">{it.mock_tests?.title || "—"}</td>
                          <td className="is-num text-white">{it.marks_obtained ?? "—"} / {it.total_marks ?? "—"}</td>
                          <td className="is-num font-semibold text-cyan-300">{it.percentage != null ? `${Number(it.percentage).toFixed(1)}%` : "—"}</td>
                          <td className="is-num text-slate-400">{it.correct_count ?? "—"} / {it.wrong_count ?? "—"} / {it.skipped_count ?? "—"}</td>
                          <td><AdminChip tone={STATUS_TONES[it.status] || "neutral"}>{String(it.status).replace("_", " ")}</AdminChip></td>
                          <td className="text-slate-400">{it.submitted_at ? new Date(it.submitted_at).toLocaleString() : "—"}</td>
                          <td className="is-num text-slate-400">{formatTime(it.time_spent_seconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-slate-400">Showing {items.length} of {total}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </AdminPanel>
      </div>
    </AdminPage>
  );
}

