import { Check, Flag, CircleDot } from "lucide-react";
import { getQuestionStatus, getQuestionStatusLabel } from "@/lib/question-state";
import type { Question, TestResponse } from "@/types";

interface QuestionPaletteProps {
  questions: Question[];
  responses: Record<string, TestResponse>;
  currentIndex: number;
  onSelectQuestion: (index: number) => void;
}

export default function QuestionPalette({
  questions,
  responses,
  currentIndex,
  onSelectQuestion,
}: QuestionPaletteProps) {
  if (!questions.length) {
    return <div className="rounded-xl border border-dashed border-border bg-muted/40 p-3 text-sm text-muted-foreground">No questions available.</div>;
  }

  return (
    <section aria-labelledby="question-palette-heading">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id="question-palette-heading" className="text-sm font-semibold">Question palette</h2>
        <p className="text-xs text-muted-foreground">
          Check = answered / Flag = marked for review / Ring = current question
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Question navigation">
        {questions.map((question, index) => {
        const response = responses[question.id];
        const status = getQuestionStatus(response, index === currentIndex);
        const isCurrent = index === currentIndex;
        const label = getQuestionStatusLabel(status);

        let classes = "relative flex h-10 min-w-10 items-center justify-center rounded-md border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ";

        if (isCurrent) {
          classes += "border-primary bg-primary text-primary-foreground ring-2 ring-primary/20 ";
        } else if (status.isAnswered && status.isMarkedForReview) {
          classes += "border-emerald-500 bg-emerald-50 text-emerald-900 ";
        } else if (status.isMarkedForReview) {
          classes += "border-amber-500 bg-amber-50 text-amber-900 ";
        } else if (status.isAnswered) {
          classes += "border-emerald-500 bg-emerald-100 text-emerald-900 ";
        } else {
          classes += "border-border bg-muted text-foreground ";
        }

        return (
          <button
            key={question.id}
            type="button"
            onClick={() => onSelectQuestion(index)}
            aria-current={isCurrent ? "step" : undefined}
            aria-label={`Question ${index + 1}, ${label}`}
            title={`Question ${index + 1}: ${label}`}
            data-question-status={label}
            className={classes}
          >
            <span>{index + 1}</span>
            {status.isAnswered && (
              <Check className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-background p-0.5 text-emerald-600" aria-hidden="true" />
            )}
            {status.isMarkedForReview && (
              <Flag className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-background p-0.5 text-amber-600" aria-hidden="true" />
            )}
            {isCurrent && (
              <CircleDot className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary text-primary-foreground" aria-hidden="true" />
            )}
          </button>
        );
        })}
      </div>
    </section>
  );
}
