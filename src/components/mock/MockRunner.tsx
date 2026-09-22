"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bookmark, Flag, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import QuestionPalette from "@/components/mock/QuestionPalette";
import TestTimer from "@/components/mock/TestTimer";
import { getQuestionStatus } from "@/lib/question-state";
import { useTestStore } from "@/stores/test-store";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!attemptId || isSubmitted || Object.keys(responses).length === 0) return;
    const timer = window.setTimeout(() => {
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
      }).catch(() => undefined);
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
        if (active) setAttempt(result.data.attempt.id, result.data.test, result.data.questions, Date.parse(result.data.attempt.started_at));
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

  const handleSelectQuestion = (index: number) => {
    const nextIndex = Math.max(0, Math.min(index, questions.length - 1));
    setCurrentIndex(nextIndex);
    if (questions[nextIndex]) markVisited(questions[nextIndex].id);
  };

  const selectOption = (optionId: string) => {
    if (!question || isSubmitted || !question.options?.some((option) => option.id === optionId)) return;
    saveResponse(question.id, { selected_option_ids: [optionId] });
  };

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

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading mock test...</p>;
  if (error) return <p role="alert" className="p-6 text-sm text-destructive">{error}</p>;
  if (!question || !mockTest) return <p className="p-6 text-sm text-muted-foreground">This mock test is unavailable.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div><p className="text-sm text-muted-foreground">{mockTest.title}</p><h1 className="text-xl font-bold">Question {currentIndex + 1} of {questions.length}</h1></div>
        <TestTimer expiresAt={expiresAt} onExpire={expireTest} />
      </div>
      {isSubmitted ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center">
          <h2 className="text-lg font-bold">{isExpired ? "Time expired" : "Test submitted"}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{isExpired ? "Your answers have been submitted and this attempt is now closed." : `You answered ${answeredCount} of ${questions.length} questions.`}</p>
          <Button variant="outline" className="mt-4 inline-flex items-center gap-2" onClick={() => { resetTest(); router.refresh(); }}><RotateCcw className="h-4 w-4" />Start again</Button>
        </div>
      ) : (
        <>
          <QuestionPalette questions={questions} responses={responses} currentIndex={currentIndex} onSelectQuestion={handleSelectQuestion} />
          <article><p className="text-lg leading-8">{question.question_text}</p>{question.image_url && <img src={question.image_url} alt="Question illustration" className="mt-4 max-h-72 rounded-md" />}</article>
          <fieldset className="grid gap-3"><legend className="sr-only">Choose an answer for question {currentIndex + 1}</legend>{question.options?.map((option, index) => {
            const selected = response?.selected_option_ids?.includes(option.id);
            return <label key={option.id} className={`flex cursor-pointer gap-3 rounded-lg border p-4 text-left text-sm transition ${selected ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border hover:bg-muted"}`}><input type="radio" name={`question-${question.id}`} checked={Boolean(selected)} onChange={() => selectOption(option.id)} className="mt-0.5 h-4 w-4 accent-primary" /><span><span className="mr-2 font-semibold">{String.fromCharCode(65 + index)}.</span>{option.option_text}</span></label>;
          })}</fieldset>
          <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-5">
            <div className="flex gap-2"><Button variant="outline" onClick={() => handleSelectQuestion(currentIndex - 1)} disabled={currentIndex === 0}><ArrowLeft className="h-4 w-4" />Previous</Button><Button variant="outline" onClick={() => handleSelectQuestion(currentIndex + 1)} disabled={currentIndex === questions.length - 1}>Next<ArrowRight className="h-4 w-4" /></Button></div>
            <div className="flex gap-2"><Button variant="outline" onClick={() => toggleReviewLater(question.id)} aria-pressed={Boolean(response?.is_review_later)}><Flag className="h-4 w-4" />{response?.is_review_later ? "Unmark review" : "Mark review"}</Button><Button variant="outline" onClick={() => toggleBookmark(question.id)}><Bookmark className="h-4 w-4" />Save</Button><Button variant="ghost" onClick={() => clearAnswer(question.id)} disabled={!response?.selected_option_ids?.length}>Clear answer</Button><Button onClick={() => setShowConfirm(true)}>Submit</Button></div>
          </div>
        </>
      )}
      {showConfirm && <div role="dialog" aria-modal="true" aria-label="Confirm submission" className="rounded-xl p-4 glass-panel"><p className="font-semibold">Submit your test?</p><p className="mt-1 text-sm text-muted-foreground">You have answered {answeredCount} of {questions.length} questions.</p><div className="mt-4 flex gap-2"><Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button><Button onClick={completeSubmit} disabled={submitting}>{submitting ? "Submitting..." : "Submit test"}</Button></div></div>}
    </div>
  );
}
