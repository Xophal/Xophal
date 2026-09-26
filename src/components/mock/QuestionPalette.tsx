"use client";

import { Check, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getQuestionStatus,
  getQuestionStatusLabel,
  getQuestionVisualState,
  QUESTION_STATE_LEGEND,
} from "@/lib/question-state";
import type { Question, TestResponse } from "@/types";

interface QuestionPaletteProps {
  questions: Question[];
  responses: Record<string, TestResponse>;
  currentIndex: number;
  onSelectQuestion: (index: number) => void;
  /** Hide the state legend when the palette is rendered in a compact surface. */
  showLegend?: boolean;
  className?: string;
}

export default function QuestionPalette({
  questions,
  responses,
  currentIndex,
  onSelectQuestion,
  showLegend = true,
  className,
}: QuestionPaletteProps) {
  if (!questions.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        No questions available.
      </div>
    );
  }

  return (
    <section aria-labelledby="question-palette-heading" className={cn("flex flex-col gap-4", className)}>
      <div>
        <h2 id="question-palette-heading" className="exam-section-title">
          Question palette
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">Select a number to jump to that question.</p>
      </div>

      <div className="exam-palette-grid" role="group" aria-label="Question navigation">
        {questions.map((question, index) => {
          const response = responses[question.id];
          const status = getQuestionStatus(response, index === currentIndex);
          const isCurrent = index === currentIndex;
          const visualState = getQuestionVisualState(status);
          const label = getQuestionStatusLabel(status);

          return (
            <button
              key={question.id}
              type="button"
              onClick={() => onSelectQuestion(index)}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`Question ${index + 1}, ${label}`}
              title={`Question ${index + 1}: ${label}`}
              data-question-status={label}
              data-state={isCurrent ? "current" : visualState}
              data-current={isCurrent}
              className="exam-palette-cell"
            >
              <span aria-hidden="true">{index + 1}</span>
              {status.isAnswered && (
                <span className="exam-palette-cell__badge" aria-hidden="true">
                  <Check className="h-2.5 w-2.5" />
                </span>
              )}
              {status.isMarkedForReview && (
                <span className="exam-palette-cell__badge" data-tone="review" aria-hidden="true">
                  <Flag className="h-2.5 w-2.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {showLegend && (
        <div>
          <h3 className="exam-eyebrow">Legend</h3>
          <ul className="mt-2 space-y-1.5">
            {QUESTION_STATE_LEGEND.map((entry) => (
              <li key={entry.state} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <span
                  aria-hidden="true"
                  data-state={entry.state}
                  data-current={entry.state === "current"}
                  className="exam-palette-cell relative h-7 w-7 shrink-0 text-[0.6875rem]"
                >
                  {entry.state === "marked" || entry.state === "answered-marked" ? (
                    <Flag className="h-3 w-3" />
                  ) : entry.state === "answered" ? (
                    <Check className="h-3 w-3" />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">{entry.label}</span>
                  <span className="block">{entry.hint}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
