"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleSlash, Clock3, RotateCcw, Target, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Result = {
  status: string;
  marks_obtained: number;
  total_marks: number;
  percentage: number;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  time_spent_seconds: number;
  accuracy: number;
  test_responses?: Array<{
    question_id: string;
    selected_option_ids: string[] | null;
    text_answer: string | null;
    is_correct: boolean | null;
    marks_awarded: number;
    questions: {
      question_text: string;
      explanation: string | null;
      question_options: Array<{ id: string; option_text: string; is_correct: boolean }>;
    } | null;
  }>;
};

type Outcome = "correct" | "incorrect" | "skipped";
type Filter = "all" | Outcome;

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function outcomeOf(isCorrect: boolean | null): Outcome {
  if (isCorrect === true) return "correct";
  if (isCorrect === false) return "incorrect";
  return "skipped";
}

const OUTCOME_META: Record<Outcome, { label: string; icon: typeof CheckCircle2; className: string }> = {
  correct: { label: "Correct", icon: CheckCircle2, className: "text-[hsl(var(--exam-state-correct))]" },
  incorrect: { label: "Incorrect", icon: XCircle, className: "text-[hsl(var(--exam-state-incorrect))]" },
  skipped: { label: "Unanswered", icon: CircleSlash, className: "text-muted-foreground" },
};

export default function ResultPageClient({ attemptId }: { attemptId: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let active = true;
    fetch(`/api/mock-tests/results/${attemptId}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load result");
        if (active) setResult(body.data);
      })
      .catch((cause: Error) => {
        if (active) setError(cause.message);
      });
    return () => {
      active = false;
    };
  }, [attemptId]);

  const responses = useMemo(
    () =>
      (result?.test_responses ?? []).map((response, index) => ({
        ...response,
        number: index + 1,
        outcome: outcomeOf(response.is_correct),
      })),
    [result]
  );

  const filtered = useMemo(
    () => (filter === "all" ? responses : responses.filter((item) => item.outcome === filter)),
    [filter, responses]
  );

  if (error) {
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-16">
        <div className="exam-panel p-8 text-center" role="alert">
          <h1 className="text-xl font-bold">Result unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Something went wrong while loading your result. Your attempt is safe and still saved.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">{error}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button className="exam-cta" onClick={() => window.location.reload()}>Try again</Button>
            <Button variant="outline" asChild>
              <Link href="/mock-tests">Back to tests</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-16" aria-busy="true">
        <span className="sr-only">Loading your result</span>
        <div className="h-9 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-44 animate-pulse rounded-xl bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </main>
    );
  }

  const percentage = Math.max(0, Math.min(100, result.percentage ?? 0));
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const totalQuestions = result.correct_count + result.wrong_count + result.skipped_count;
  const attempted = totalQuestions - result.skipped_count;
  const attemptedPercent = totalQuestions ? (attempted / totalQuestions) * 100 : 0;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="exam-eyebrow">{result.status === "expired" ? "Time expired" : "Submitted"}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Your result</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/mock-tests">
              <RotateCcw className="h-4 w-4" />
              Retake test
            </Link>
          </Button>
          <Button asChild className="exam-cta">
            <Link href="/dashboard">
              Go to dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <section className="exam-panel mt-6 grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="relative mx-auto h-32 w-32 shrink-0">
          <svg viewBox="0 0 120 120" className="exam-ring h-full w-full" aria-hidden="true">
            <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="10" className="exam-ring__track" />
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              strokeWidth="10"
              className="exam-ring__value"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tabular-nums">{percentage.toFixed(0)}%</span>
            <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Score
            </span>
          </div>
        </div>

        <div>
          <p className="exam-section-title">
            {result.marks_obtained} of {result.total_marks} marks
          </p>
          <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
            {attempted} of {totalQuestions} questions attempted in {formatTime(result.time_spent_seconds)}.{" "}
            {result.wrong_count > 0
              ? "Review the incorrect answers below, then practise the topics you missed."
              : result.skipped_count > 0
                ? "Attempting the skipped questions first is the fastest way to gain marks."
                : "A clean sweep. Keep the momentum with a harder paper."}
          </p>
          <div
            className="exam-progress-track mt-4"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={totalQuestions}
            aria-valuenow={attempted}
            aria-label="Questions attempted"
          >
            <div className="exam-progress-bar" style={{ width: `${attemptedPercent}%` }} />
          </div>
        </div>
      </section>

      <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Accuracy", value: `${result.accuracy}%`, hint: "correct over attempted" },
          { label: "Correct", value: result.correct_count, hint: "questions" },
          { label: "Incorrect", value: result.wrong_count, hint: "questions" },
          { label: "Unanswered", value: result.skipped_count, hint: "questions" },
        ].map((stat) => (
          <div key={stat.label} className="exam-stat">
            <dt className="exam-stat__label">{stat.label}</dt>
            <dd className="exam-stat__value">{stat.value}</dd>
            <dd className="exam-stat__hint">{stat.hint}</dd>
          </div>
        ))}
      </dl>

      <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="exam-stat flex items-center gap-3">
          <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <dt className="exam-stat__label">Time taken</dt>
            <dd className="exam-stat__value text-lg">{formatTime(result.time_spent_seconds)}</dd>
          </div>
        </div>
        <div className="exam-stat flex items-center gap-3">
          <Target className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <dt className="exam-stat__label">Attempted</dt>
            <dd className="exam-stat__value text-lg">
              {attempted}
              <span className="text-xs font-medium text-muted-foreground">/{totalQuestions}</span>
            </dd>
          </div>
        </div>
        <div className="exam-stat col-span-2 flex items-center gap-3 lg:col-span-1">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <dt className="exam-stat__label">Status</dt>
            <dd className="exam-stat__value text-lg">
              {result.status === "expired" ? "Auto submitted" : "Submitted"}
            </dd>
          </div>
        </div>
      </dl>

      <section className="mt-8" aria-labelledby="review-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="review-heading" className="exam-section-title">
              Question review
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every answer with its correct option and explanation.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter questions">
            {[
              { key: "all" as Filter, label: `All ${responses.length}` },
              { key: "correct" as Filter, label: `Correct ${result.correct_count}` },
              { key: "incorrect" as Filter, label: `Incorrect ${result.wrong_count}` },
              { key: "skipped" as Filter, label: `Skipped ${result.skipped_count}` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                aria-pressed={filter === tab.key}
                className={cn(
                  "min-h-9 rounded-lg border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  filter === tab.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {responses.length === 0 ? (
          <div className="exam-panel mt-4 p-8 text-center">
            <p className="text-sm font-semibold">No question data available</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This attempt did not record any questions, so there is nothing to review yet.
            </p>
            <Button asChild className="mt-5">
              <Link href="/mock-tests">Explore mock tests</Link>
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="exam-panel mt-4 p-8 text-center">
            <p className="text-sm font-semibold">Nothing in this filter</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Switch to another filter to see the rest of your answers.
            </p>
            <Button variant="outline" className="mt-5" onClick={() => setFilter("all")}>
              Show all questions
            </Button>
          </div>
        ) : (
          <ol className="mt-4 space-y-3">
            {filtered.map((item) => {
              const question = item.questions;
              const chosen = new Set(item.selected_option_ids ?? []);
              const meta = OUTCOME_META[item.outcome];
              const OutcomeIcon = meta.icon;

              return (
                <li
                  key={item.question_id}
                  className="exam-review-item exam-panel p-5"
                  data-outcome={item.outcome}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="exam-eyebrow">Question {item.number}</p>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-bold",
                        meta.className
                      )}
                    >
                      <OutcomeIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      {meta.label}
                    </span>
                  </div>

                  <p className="exam-question-text mt-2 font-medium">{question?.question_text}</p>

                  {question?.question_options?.length ? (
                    <ul className="mt-3 grid gap-2">
                      {question.question_options.map((option, optionIndex) => {
                        const isChosen = chosen.has(option.id);
                        const role = option.is_correct ? "correct" : isChosen ? "chosen" : "neutral";
                        return (
                          <li
                            key={option.id}
                            className="exam-review-option flex gap-2.5 rounded-lg border border-border px-3 py-2 text-sm"
                            data-role={role}
                          >
                            <span className="font-semibold" aria-hidden="true">
                              {String.fromCharCode(65 + optionIndex)}.
                            </span>
                            <span className="min-w-0 flex-1">{option.option_text}</span>
                            {option.is_correct && (
                              <span className="text-[0.6875rem] font-bold uppercase tracking-wide">
                                Correct answer
                              </span>
                            )}
                            {!option.is_correct && isChosen && (
                              <span className="text-[0.6875rem] font-bold uppercase tracking-wide">
                                Your answer
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    item.text_answer && (
                      <p className="mt-3 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
                        {item.text_answer}
                      </p>
                    )
                  )}

                  {question?.explanation && (
                    <details className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
                      <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        Explanation
                      </summary>
                      <p className="mt-2 text-sm leading-6 text-foreground">{question.explanation}</p>
                    </details>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
