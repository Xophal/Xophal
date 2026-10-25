"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Option = { id: string; label: string | null; body: string | null; position: number | null };
type SavedResponse = {
  selected_options: string[];
  text_answer: string | null;
  numerical_answer: number | null;
};
type EngineQuestion = {
  questionId: string;
  type: string;
  stem: string;
  marks: number;
  negMarks: number;
  position: number;
  select_multiple?: boolean;
  options: Option[];
  response?: {
    response_json: SavedResponse;
    time_spent_sec: number;
    flagged: boolean;
  } | null;
};
type EngineAnswer = SavedResponse & { time_spent_sec: number; flagged: boolean };

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export default function EngineTestRunner({ blueprintSlug }: { blueprintSlug: string }) {
  const router = useRouter();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);
  const [questions, setQuestions] = useState<EngineQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, EngineAnswer>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error" | "idle">("idle");
  const [error, setError] = useState<string | null>(null);
  const answersRef = useRef(answers);
  const submitLock = useRef(false);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    let active = true;
    async function start() {
      try {
        const response = await fetch("/api/test-instances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blueprintSlug }),
        });
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error(body.error || "Unable to start this test.");
        const attempt = body.data.attempt;
        const questionResponse = await fetch(`/api/attempts/${attempt.attemptId}/questions`);
        const questionBody = await questionResponse.json();
        if (!questionResponse.ok || !questionBody.success) {
          throw new Error(questionBody.error || "Unable to load this test.");
        }
        if (!active) return;
        setAttemptId(attempt.attemptId);
        setDeadlineAt(attempt.deadlineAt);
        const loaded = questionBody.data.questions as EngineQuestion[];
        setQuestions(loaded);
        setAnswers(Object.fromEntries(loaded.flatMap((question) => {
          if (!question.response) return [];
          return [[question.questionId, {
            ...question.response.response_json,
            time_spent_sec: question.response.time_spent_sec,
            flagged: question.response.flagged,
          }]];
        })));
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to start this test.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void start();
    return () => { active = false; };
  }, [blueprintSlug]);

  const submitAttempt = useCallback(async (expired = false) => {
    if (!attemptId || submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/attempts/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: Object.entries(answersRef.current).map(([question_id, answer]) => ({
            question_id,
            response_json: {
              selected_options: answer.selected_options,
              text_answer: answer.text_answer,
              numerical_answer: answer.numerical_answer,
            },
            time_spent_sec: answer.time_spent_sec,
            flagged: answer.flagged,
          })),
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || "Unable to submit this test.");
      router.push(`/engine-tests/result/${attemptId}`);
    } catch (cause) {
      submitLock.current = false;
      setError(cause instanceof Error ? cause.message : "Unable to submit this test.");
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, router]);

  useEffect(() => {
    if (!attemptId || !deadlineAt) return;
    const updateRemaining = () => {
      const seconds = Math.max(0, Math.ceil((Date.parse(deadlineAt) - Date.now()) / 1000));
      setRemainingSeconds(seconds);
      if (seconds === 0) void submitAttempt(true);
    };
    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(interval);
  }, [attemptId, deadlineAt, submitAttempt]);

  useEffect(() => {
    if (!attemptId || Object.keys(answers).length === 0 || submitLock.current) return;
    const timeout = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        const response = await fetch(`/api/attempts/${attemptId}/answers`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: Object.entries(answers).map(([question_id, answer]) => ({ question_id, ...answer })),
          }),
        });
        setSaveState(response.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [attemptId, answers]);

  const question = questions[currentIndex];
  const answer = question ? answers[question.questionId] : undefined;
  const setAnswer = (questionId: string, patch: Partial<EngineAnswer>) => {
    setAnswers((current) => ({
      ...current,
      [questionId]: {
        ...(current[questionId] ?? {
          selected_options: [],
          text_answer: null,
          numerical_answer: null,
          time_spent_sec: 0,
          flagged: false,
        }),
        ...patch,
      },
    }));
  };

  if (loading) return <main className="mx-auto max-w-3xl p-8" aria-busy="true">Preparing your test…</main>;
  if (error && questions.length === 0) {
    return <main className="mx-auto max-w-xl p-8" role="alert"><h1 className="text-xl font-bold">Test unavailable</h1><p className="mt-2">{error}</p></main>;
  }
  if (!question) return <main className="mx-auto max-w-xl p-8">This test has no questions.</main>;

  const selected = answer?.selected_options ?? [];
  const isMulti = question.select_multiple === true || question.type === "multiple_correct";
  const setSelected = (label: string) => {
    const next = isMulti
      ? selected.includes(label) ? selected.filter((item) => item !== label) : [...selected, label]
      : [label];
    setAnswer(question.questionId, { selected_options: next });
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm text-muted-foreground">Question {currentIndex + 1} of {questions.length}</p><h1 className="text-xl font-bold">{blueprintSlug}</h1></div>
        <div className="text-lg font-semibold tabular-nums" role="timer" aria-label={`${formatTime(remainingSeconds)} remaining`}>{formatTime(remainingSeconds)}</div>
      </header>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground" aria-live="polite">
        <span>{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : " "}</span>
        <span>{question.marks} marks{question.negMarks ? ` · −${question.negMarks} for an incorrect answer` : ""}</span>
      </div>
      <section className="mt-4 rounded-xl border border-border bg-card p-5 sm:p-7">
        <h2 className="text-lg font-semibold leading-relaxed">{question.stem}</h2>
        {question.options.length ? (
          <fieldset className="mt-5 grid gap-3">
            <legend className="sr-only">{isMulti ? "Select all correct options" : "Select one option"}</legend>
            {question.options.map((option) => {
              const label = option.label ?? "";
              return (
                <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
                  <input
                    type={isMulti ? "checkbox" : "radio"}
                    name={`engine-question-${question.questionId}`}
                    checked={selected.includes(label)}
                    onChange={() => setSelected(label)}
                    className="mt-1"
                  />
                  <span className="font-medium">{label}.</span><span>{option.body}</span>
                </label>
              );
            })}
          </fieldset>
        ) : (
          <label className="mt-5 grid gap-2">
            <span className="text-sm font-medium">Your response</span>
            <textarea
              value={answer?.text_answer ?? ""}
              onChange={(event) => setAnswer(question.questionId, { text_answer: event.target.value })}
              rows={5}
              maxLength={10000}
              className="rounded-lg border border-border bg-background p-3"
            />
          </label>
        )}
      </section>
      {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
      <nav className="mt-4 flex flex-wrap justify-between gap-2" aria-label="Test navigation">
        <Button variant="outline" disabled={currentIndex === 0} onClick={() => setCurrentIndex((index) => index - 1)}>Previous</Button>
        {currentIndex < questions.length - 1
          ? <Button onClick={() => setCurrentIndex((index) => index + 1)}>Next question</Button>
          : <Button onClick={() => void submitAttempt(false)} isLoading={submitting} loadingText="Submitting…">Submit test</Button>}
      </nav>
    </main>
  );
}
