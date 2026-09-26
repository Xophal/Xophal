"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bookmark, Eraser, Flag, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ExamAnswer from "@/components/mock/ExamAnswer";
import ExamHeader from "@/components/mock/ExamHeader";
import ExamSidebar from "@/components/mock/ExamSidebar";
import SaveStatus, { type SaveState } from "@/components/mock/SaveStatus";
import { getQuestionStatus, getQuestionVisualState, QUESTION_STATE_LEGEND } from "@/lib/question-state";
import { useTestStore } from "@/stores/test-store";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";

export default function MockRunner({ slug }: { slug: string }) {
  const router = useRouter();
  const questions = useTestStore((state) => state.questions);
  const mockTest = useTestStore((state) => state.mockTest);
  const attemptId = useTestStore((state) => state.attemptId);
  const currentIndex = useTestStore((state) => state.currentIndex);
  const responses = useTestStore((state) => state.responses);
  const expiresAt = useTestStore((state) => state.expiresAt);
  const isSubmitted = useTestStore((state) => state.isSubmitted);
  const isExpired = useTestStore((state) => state.isExpired);
  const setAttempt = useTestStore((state) => state.setAttempt);
  const setCurrentIndex = useTestStore((state) => state.setCurrentIndex);
  const markVisited = useTestStore((state) => state.markVisited);
  const saveResponse = useTestStore((state) => state.saveResponse);
  const clearAnswer = useTestStore((state) => state.clearAnswer);
  const toggleBookmark = useTestStore((state) => state.toggleBookmark);
  const toggleReviewLater = useTestStore((state) => state.toggleReviewLater);
  const submitTest = useTestStore((state) => state.submitTest);
  const expireTest = useTestStore((state) => state.expireTest);
  const resetTest = useTestStore((state) => state.resetTest);
  const hydrateResponses = useTestStore((state) => state.hydrateResponses);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    if (!attemptId || isSubmitted || Object.keys(responses).length === 0) return;
    const timer = window.setTimeout(() => {
      setSaveState("saving");
      void fetch(`/api/mock-tests/attempts/${attemptId}/responses`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: Object.values(responses).map((item) => ({
          question_id: item.question_id,
          selected_option_ids: item.selected_option_ids ?? [],
          text_answer: item.text_answer ?? null,
          numerical_answer: item.numerical_answer ?? null,
          time_spent_seconds: item.time_spent_seconds || 0,
          is_bookmarked: Boolean(item.is_bookmarked),
          is_review_later: Boolean(item.is_review_later),
          is_visited: Boolean(item.is_visited),
        })) }),
      })
        .then((result) => {
          setSaveState(result.ok ? "saved" : "error");
        })
        .catch(() => setSaveState("error"));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [attemptId, isSubmitted, responses]);

  useEffect(() => {
    let active = true;
    async function loadAttempt() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/mock-tests/${encodeURIComponent(slug)}/attempt`, { method: "POST" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.error || "Unable to start this mock test.");
        if (active) {
          setAttempt(result.data.attempt.id, result.data.test, result.data.questions, Date.parse(result.data.attempt.started_at));
          if (Array.isArray(result.data.responses)) hydrateResponses(result.data.responses);
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load this mock test.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadAttempt();
    return () => { active = false; };
  }, [setAttempt, slug]);

  const question = questions[currentIndex];
  const response = question ? responses[question.id] : undefined;
  const answeredCount = Object.values(responses).filter((item) => getQuestionStatus(item).isAnswered).length;


  const selectOption = (optionId: string) => {
    if (!question || isSubmitted || !question.options?.some((option) => option.id === optionId)) return;
    const isMultiple = question.question_type?.code === "multiple_correct";
    if (!isMultiple) {
      saveResponse(question.id, { selected_option_ids: [optionId] });
      return;
    }
    const selected = new Set(response?.selected_option_ids ?? []);
    if (selected.has(optionId)) selected.delete(optionId); else selected.add(optionId);
    saveResponse(question.id, { selected_option_ids: [...selected] });
  };

  const saveTextAnswer = (text_answer: string) => saveResponse(question.id, { text_answer: text_answer || null });
  const saveNumericalAnswer = (value: string) => saveResponse(question.id, { numerical_answer: value === "" || Number.isNaN(Number(value)) ? null : Number(value) });

  async function completeSubmit() {
    if (!attemptId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/mock-tests/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attempt_id: attemptId,
          expired: isExpired,
          responses: Object.values(responses).map((item) => ({
            question_id: item.question_id,
            ...(item.selected_option_ids?.length ? { selected_option_ids: item.selected_option_ids } : {}),
            ...(item.text_answer ? { text_answer: item.text_answer } : {}),
            ...(item.numerical_answer != null ? { numerical_answer: item.numerical_answer } : {}),
            time_spent_seconds: item.time_spent_seconds || 0,
            is_bookmarked: Boolean(item.is_bookmarked),
            is_review_later: Boolean(item.is_review_later),
          })),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to submit this test.");
      submitTest();
      setShowConfirm(false);
      router.push(`/test/result/${attemptId}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit this test.");
    } finally {
      setSubmitting(false);
    }
  }

  const currentState = getQuestionVisualState(getQuestionStatus(response, true));

  // Close the mobile palette sheet on Escape.
  useEffect(() => {
    if (!paletteOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [paletteOpen]);

  // Jump to a question, mark it visited, and close the mobile palette sheet.
  const goTo = (index: number) => {
    const nextIndex = Math.max(0, Math.min(index, questions.length - 1));
    setCurrentIndex(nextIndex);
    if (questions[nextIndex]) markVisited(questions[nextIndex].id);
    setPaletteOpen(false);
  };

  if (loading) {
    return (
      <div className="exam-shell">
        <div className="mx-auto w-full max-w-3xl space-y-4 p-6" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading mock test...</span>
          <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
          <div className="h-12 animate-pulse rounded-lg bg-muted" />
          <div className="h-12 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="exam-shell">
        <div className="mx-auto w-full max-w-lg p-6">
          <div className="exam-panel p-8 text-center" role="alert">
            <h1 className="text-lg font-bold">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We could not load this mock test. Your progress is safe - nothing was submitted.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">{error}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button className="exam-cta" onClick={() => window.location.reload()}>Try again</Button>
              <Button variant="outline" asChild>
                <a href="/mock-tests">Back to mock tests</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!question || !mockTest) {
    return (
      <div className="exam-shell">
        <EmptyState
          icon="test"
          title="This mock test is unavailable"
          description="It may have been unpublished or removed. Browse the current catalogue to find a similar test."
          actionLabel="Explore mock tests"
          actionHref="/mock-tests"
        />
      </div>
    );
  }


  return (
    <div className="exam-shell">
      <ExamHeader
        title={mockTest.title}
        currentIndex={currentIndex}
        totalQuestions={questions.length}
        answeredCount={answeredCount}
        expiresAt={expiresAt}
        saveState={saveState}
        onExpire={expireTest}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      <div className="exam-body">
        <aside className="exam-sidebar hidden lg:block lg:h-[calc(100vh-7.5rem)] lg:overflow-y-auto">
          <ExamSidebar
            questions={questions}
            responses={responses}
            currentIndex={currentIndex}
            onSelectQuestion={goTo}
            onSubmit={() => setShowConfirm(true)}
            submitting={submitting}
          />
        </aside>

        <main className="exam-main" id="exam-main">
          <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
            {isSubmitted ? (
              <div className="exam-panel p-8 text-center">
                <h1 className="text-xl font-bold">{isExpired ? "Time expired" : "Test submitted"}</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {isExpired
                    ? "Your answers have been submitted and this attempt is now closed."
                    : `You answered ${answeredCount} of ${questions.length} questions.`}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button
                    variant="outline"
                    className="inline-flex items-center gap-2"
                    onClick={() => {
                      resetTest();
                      router.refresh();
                    }}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Start again
                  </Button>
                  {attemptId && (
                    <Button asChild>
                      <a href={`/test/result/${attemptId}`}>View result</a>
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <article className="exam-panel p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="exam-eyebrow">
                      Question {currentIndex + 1} of {questions.length}
                    </p>
                    <span
                      className="rounded-full border border-border px-2.5 py-1 text-[0.6875rem] font-semibold text-muted-foreground"
                      data-state={currentState}
                    >
                      {currentState === "answered"
                        ? "Answered"
                        : currentState === "answered-marked"
                          ? "Answered · marked for review"
                          : currentState === "marked"
                            ? "Marked for review"
                            : "Not answered yet"}
                    </span>
                  </div>

                  <h1 className="mt-3 text-lg font-bold leading-snug sm:text-xl">
                    {question.question_text}
                  </h1>
                  {question.marks > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {question.marks} mark{question.marks === 1 ? "" : "s"}
                      {question.negative_marks > 0 && ` · −${question.negative_marks} for a wrong answer`}
                    </p>
                  )}
                  {question.image_url && (
                    <img
                      src={question.image_url}
                      alt={`Figure for question ${currentIndex + 1}`}
                      className="exam-figure"
                      loading="lazy"
                    />
                  )}
                </article>

                <div className="exam-panel mt-4 p-5 sm:p-6">
                  <ExamAnswer
                    question={question}
                    response={response}
                    onSelectOption={selectOption}
                    onTextAnswer={saveTextAnswer}
                    onNumericalAnswer={saveNumericalAnswer}
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => toggleReviewLater(question.id)}
                    aria-pressed={Boolean(response?.is_review_later)}
                    className={cn(response?.is_review_later && "border-warning text-warning")}
                  >
                    <Flag className="h-4 w-4" />
                    {response?.is_review_later ? "Marked for review" : "Mark for review"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => toggleBookmark(question.id)}
                    aria-pressed={Boolean(response?.is_bookmarked)}
                    className={cn(response?.is_bookmarked && "border-primary text-primary")}
                  >
                    <Bookmark className="h-4 w-4" />
                    {response?.is_bookmarked ? "Bookmarked" : "Bookmark"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => clearAnswer(question.id)}
                    disabled={
                      !response?.selected_option_ids?.length &&
                      !response?.text_answer &&
                      response?.numerical_answer == null
                    }
                  >
                    <Eraser className="h-4 w-4" />
                    Clear answer
                  </Button>
                  <SaveStatus state={saveState} className="ml-auto sm:hidden" />
                </div>

                <nav
                  aria-label="Question navigation"
                  className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4"
                >
                  <Button
                    variant="outline"
                    onClick={() => goTo(currentIndex - 1)}
                    disabled={currentIndex === 0}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {answeredCount} of {questions.length} answered
                  </span>
                  {currentIndex === questions.length - 1 ? (
                    <Button className="exam-cta" onClick={() => setShowConfirm(true)}>Review &amp; submit</Button>
                  ) : (
                    <Button className="exam-cta" onClick={() => goTo(currentIndex + 1)}>
                      Save &amp; next
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </nav>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Mobile / tablet palette sheet */}
      {paletteOpen && !isSubmitted && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close question palette"
            className="absolute inset-0 h-full w-full bg-foreground/40"
            onClick={() => setPaletteOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Question palette"
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-4 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="exam-section-title">Question palette</h2>
              <button
                type="button"
                onClick={() => setPaletteOpen(false)}
                aria-label="Close palette"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ExamSidebar
              questions={questions}
              responses={responses}
              currentIndex={currentIndex}
              onSelectQuestion={goTo}
              onSubmit={() => {
                setPaletteOpen(false);
                setShowConfirm(true);
              }}
              submitting={submitting}
              showLegend={false}
            />
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/40 sm:items-center sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-confirm-title"
            className="w-full max-w-md rounded-t-2xl border border-border bg-card p-6 shadow-2xl sm:rounded-2xl"
          >
            <h2 id="submit-confirm-title" className="text-lg font-bold">
              Submit your test?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You have answered {answeredCount} of {questions.length} questions
              {answeredCount < questions.length
                ? `, leaving ${questions.length - answeredCount} unanswered.`
                : "."}
            </p>
            <ul className="mt-4 space-y-1.5">
              {QUESTION_STATE_LEGEND.filter((entry) => entry.state !== "current").map((entry) => (
                <li key={entry.state} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    aria-hidden="true"
                    data-state={entry.state}
                    className="exam-legend-swatch"
                  />
                  {entry.label}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                Keep reviewing
              </Button>
              <Button className="exam-cta" onClick={completeSubmit} isLoading={submitting} loadingText="Submitting…">
                Submit test
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
