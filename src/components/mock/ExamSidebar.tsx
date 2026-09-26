"use client";

import { CheckCircle2, Flag, Send } from "lucide-react";
import QuestionPalette from "@/components/mock/QuestionPalette";
import { Button } from "@/components/ui/button";
import { getQuestionStatus } from "@/lib/question-state";
import type { Question, TestResponse } from "@/types";

interface ExamSidebarProps {
  questions: Question[];
  responses: Record<string, TestResponse>;
  currentIndex: number;
  onSelectQuestion: (index: number) => void;
  onSubmit: () => void;
  submitting: boolean;
  showLegend?: boolean;
  className?: string;
}

/** Left rail of the exam workspace: live summary, palette, and submit. */
export default function ExamSidebar({
  questions,
  responses,
  currentIndex,
  onSelectQuestion,
  onSubmit,
  submitting,
  showLegend = true,
  className,
}: ExamSidebarProps) {
  const answered = Object.values(responses).filter((item) => getQuestionStatus(item).isAnswered).length;
  const marked = Object.values(responses).filter((item) => item.is_review_later).length;
  const notVisited = Math.max(0, questions.length - Object.keys(responses).length);

  return (
    <div className={`flex flex-col gap-5 p-4 sm:p-5 ${className ?? ""}`}>
      <dl className="grid grid-cols-3 gap-2">
        <div className="exam-stat px-2 py-2 text-center">
          <dt className="exam-stat__label text-[0.625rem]">Answered</dt>
          <dd className="exam-stat__value text-lg">
            {answered}
            <span className="text-xs font-medium text-muted-foreground">/{questions.length}</span>
          </dd>
        </div>
        <div className="exam-stat px-2 py-2 text-center">
          <dt className="exam-stat__label text-[0.625rem]">Review</dt>
          <dd className="exam-stat__value text-lg">{marked}</dd>
        </div>
        <div className="exam-stat px-2 py-2 text-center">
          <dt className="exam-stat__label text-[0.625rem]">New</dt>
          <dd className="exam-stat__value text-lg">{notVisited}</dd>
        </div>
      </dl>

      <QuestionPalette
        questions={questions}
        responses={responses}
        currentIndex={currentIndex}
        onSelectQuestion={onSelectQuestion}
        showLegend={showLegend}
      />

      <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
        <Button type="button" onClick={onSubmit} isLoading={submitting} loadingText="Submitting…">
          <Send className="h-4 w-4" />
          Submit test
        </Button>
        <p className="flex items-start gap-1.5 text-[0.6875rem] leading-5 text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Answers save automatically as you move between questions.
        </p>
        <p className="flex items-start gap-1.5 text-[0.6875rem] leading-5 text-muted-foreground">
          <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          You can change any answer until you submit or time runs out.
        </p>
      </div>
    </div>
  );
}
