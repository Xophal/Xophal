"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function formatTime(seconds: number | null) { if (!seconds && seconds !== 0) return "—"; return `${Math.floor((seconds||0)/60)}m ${(seconds||0)%60}s`; }

export default function AdminResultDetail({ params }: { params: { id: string } }) {
  const { id } = params;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/results/${id}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed');
      setData(json.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  if (loading) return <div className="p-6">Loading…</div>;
  if (!data) return <div className="p-6">Result not found</div>;

  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Result — {data.mock_tests?.title || data.id}</h1>
        <div className="text-sm text-muted-foreground">Student: {data.profiles?.full_name || data.profiles?.email}</div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Score</div>
          <div className="text-3xl font-black">{data.marks_obtained} <span className="text-sm">/ {data.total_marks}</span></div>
          <div className="mt-2">{data.percentage}%</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Counts</div>
          <div className="mt-1">Correct: {data.correct_count}</div>
          <div>Wrong: {data.wrong_count}</div>
          <div>Unanswered: {data.skipped_count}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Timing</div>
          <div className="mt-1">Time taken: {formatTime(data.time_spent_seconds)}</div>
          <div>Submitted: {data.submitted_at ? new Date(data.submitted_at).toLocaleString() : '—'}</div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Question-level review</h2>
        {!data.test_responses || data.test_responses.length === 0 ? <div className="mt-4">No responses recorded.</div> : (
          <ol className="mt-4 space-y-4">
            {data.test_responses.map((r:any, idx:number) => {
              const snap = r.question_snapshot;
              const state = r.is_correct === true ? 'Correct' : r.is_correct === false ? 'Incorrect' : 'Unanswered';
              return (
                <li key={r.question_id} className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground">Question {idx+1} — {state}</div>
                      {snap ? <div className="mt-2 font-medium">{snap?.question_text ?? 'Question'}</div> : <div className="mt-2 font-medium">Question id: {r.question_id}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-sm">Marks: {r.marks_awarded}</div>
                      <div className="text-sm">Time: {formatTime(r.time_spent_seconds)}</div>
                    </div>
                  </div>
                  {snap ? (
                    <div className="mt-3 text-sm text-muted-foreground">Snapshot present — showing historical question content.</div>
                  ) : (
                    <div className="mt-3 text-sm text-warning">No snapshot saved. Current question content is not shown to preserve historical integrity.</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
