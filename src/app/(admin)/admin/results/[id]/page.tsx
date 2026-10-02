"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type ResultResponse = {
  question_id: string;
  is_correct: boolean | null;
  marks_awarded: number | null;
  time_spent_seconds: number | null;
  question_snapshot: { question_text?: string | null } | null;
};
type ResultDetail = {
  id: string;
  marks_obtained: number | null;
  total_marks: number | null;
  percentage: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  skipped_count: number | null;
  time_spent_seconds: number | null;
  submitted_at: string | null;
  mock_tests: { title: string } | null;
  profiles: { full_name: string | null; email: string | null } | null;
  test_responses: ResultResponse[];
};

function formatTime(seconds: number | null) { if (!seconds && seconds !== 0) return "—"; return `${Math.floor((seconds||0)/60)}m ${(seconds||0)%60}s`; }

export default function AdminResultDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [result, setResult] = useState<{ id: string; data: ResultDetail | null } | null>(null);
  const loading = result?.id !== id;
  const data = result?.id === id ? result.data : null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/results/${id}`, { cache: "no-store" });
        const json = (await res.json()) as { success: boolean; data?: ResultDetail; error?: string };
        if (!res.ok || !json.success || !json.data) throw new Error(json.error || "Failed to load result");
        if (!cancelled) setResult({ id, data: json.data });
      } catch {
        if (!cancelled) setResult({ id, data: null });
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!data) return <div className="p-6">Result not found</div>;

  return (
    <div className="p-6 space-y-4">
      <Button asChild variant="ghost" size="sm"><Link href="/admin/results"><ArrowLeft className="mr-2 h-4 w-4" />Back to results</Link></Button>
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
            {data.test_responses.map((r, idx) => {
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
