"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

function formatTime(seconds: number | null) { if (!seconds && seconds !== 0) return "—"; return `${Math.floor((seconds||0)/60)}m ${(seconds||0)%60}s`; }

export default function AdminResultsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, [page]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/results?page=${page}&limit=20&q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Failed");
      setItems(json.data.items || []);
      setTotal(json.data.total || 0);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  }

  function onSearch(e: React.FormEvent) { e.preventDefault(); setPage(1); load(); }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Results</h1>
      <form onSubmit={onSearch} className="mt-4 flex gap-2">
        <input className="border p-2 flex-1" placeholder="Search by student or test" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" type="submit">Search</button>
      </form>

      <div className="mt-4 overflow-auto rounded-md border">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-muted"><tr><th className="p-2 text-left">Student</th><th>Test</th><th>Score</th><th>Max</th><th>%</th><th>Correct</th><th>Wrong</th><th>Unanswered</th><th>Status</th><th>Submitted</th><th>Time</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={11} className="p-4">Loading…</td></tr> : items.length === 0 ? <tr><td colSpan={11} className="p-4">No results</td></tr> : items.map((it:any) => (
              <tr key={it.id} className="border-t">
                <td className="p-2"><Link href={`/admin/results/${it.id}`} className="text-primary underline">{it.profiles?.full_name || it.profiles?.email || 'User'}</Link></td>
                <td className="p-2">{it.mock_tests?.title || '—'}</td>
                <td className="p-2 text-right">{it.marks_obtained ?? '—'}</td>
                <td className="p-2 text-right">{it.total_marks ?? '—'}</td>
                <td className="p-2 text-right">{it.percentage ?? '—'}</td>
                <td className="p-2 text-right">{it.correct_count ?? '—'}</td>
                <td className="p-2 text-right">{it.wrong_count ?? '—'}</td>
                <td className="p-2 text-right">{it.skipped_count ?? '—'}</td>
                <td className="p-2">{it.status}</td>
                <td className="p-2">{it.submitted_at ? new Date(it.submitted_at).toLocaleString() : '—'}</td>
                <td className="p-2">{formatTime(it.time_spent_seconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>Showing {items.length} of {total}</div>
        <div className="flex gap-2">
          <button disabled={page<=1} onClick={() => setPage(p=>Math.max(1,p-1))} className="btn">Previous</button>
          <button disabled={page*20>=total} onClick={() => setPage(p=>p+1)} className="btn">Next</button>
        </div>
      </div>
    </div>
  );
}
