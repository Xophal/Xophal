"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ResultData = {
  attempt: {
    status: string;
    maxScore: number;
  };
  questions: Array<{
    question_id: string;
    marks: number;
    question: { stem: string; options: Array<{ label: string | null; body: string | null }> };
    answer: { correct_options?: string[]; value?: string } | null;
    response: {
      response_json: { selected_options?: string[]; text_answer?: string | null; numerical_answer?: number | null };
      is_correct: boolean | null;
      marks_awarded: number | null;
    } | null;
  }>;
};

export default function EngineTestResult({ attemptId }: { attemptId: string }) {
  const [data, setData] = useState<ResultData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/attempts/${attemptId}/result`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error(body.error || "Unable to load your result.");
        if (active) setData(body.data);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load your result.");
      });
    return () => { active = false; };
  }, [attemptId]);

  if (error) return <main className="mx-auto max-w-3xl p-8" role="alert"><h1 className="text-xl font-bold">Result unavailable</h1><p className="mt-2">{error}</p></main>;
  if (!data) return <main className="mx-auto max-w-3xl p-8" aria-busy="true">Loading your result…</main>;

  const score = data.questions.reduce((total, question) => total + Number(question.response?.marks_awarded ?? 0), 0);
  const correct = data.questions.filter((question) => question.response?.is_correct === true).length;
  const incorrect = data.questions.filter((question) => question.response?.is_correct === false).length;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">{data.attempt.status === "expired" ? "Time expired" : "Submitted"}</p>
      <h1 className="mt-1 text-3xl font-bold">Your result</h1>
      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Score</p><p className="mt-1 text-2xl font-bold">{score} / {data.attempt.maxScore}</p></div>
        <div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Correct</p><p className="mt-1 text-2xl font-bold">{correct}</p></div>
        <div className="rounded-lg border border-border p-4"><p className="text-xs text-muted-foreground">Incorrect</p><p className="mt-1 text-2xl font-bold">{incorrect}</p></div>
      </section>
      <h2 className="mt-8 text-xl font-bold">Review</h2>
      <ol className="mt-3 space-y-3">
        {data.questions.map((item, index) => (
          <li key={item.question_id} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-semibold text-muted-foreground">Question {index + 1} · {item.response?.marks_awarded ?? 0} / {item.marks} marks</p>
            <p className="mt-2 font-medium">{item.question.stem}</p>
            {item.question.options?.length ? (
              <ul className="mt-3 space-y-1 text-sm">
                {item.question.options.map((option) => {
                  const chosen = item.response?.response_json.selected_options?.includes(option.label ?? "") ?? false;
                  const correctAnswer = item.answer?.correct_options?.includes(option.label ?? "") ?? false;
                  return <li key={option.label} className={correctAnswer ? "font-semibold text-green-700" : chosen ? "text-destructive" : ""}>{option.label}. {option.body}{chosen ? " (your answer)" : ""}{correctAnswer ? " (correct)" : ""}</li>;
                })}
              </ul>
            ) : item.response?.response_json.text_answer ? (
              <p className="mt-3 text-sm text-muted-foreground">Your answer: {item.response.response_json.text_answer}</p>
            ) : null}
          </li>
        ))}
      </ol>
      <Link href="/mock-tests" className="mt-6 inline-flex min-h-10 items-center rounded-md border border-border px-4 font-medium">Back to tests</Link>
    </main>
  );
}
