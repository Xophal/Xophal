"use client";

import type { Question, TestResponse } from "@/types";
import { cn } from "@/lib/utils";

const OPTION_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

interface ExamAnswerProps {
  question: Question;
  response?: TestResponse;
  onSelectOption: (optionId: string) => void;
  onTextAnswer: (value: string) => void;
  onNumericalAnswer: (value: string) => void;
  disabled?: boolean;
}

/**
 * Renders the answer area for the current question. Question data and
 * evaluation logic are untouched — only presentation is centralised here.
 */
export default function ExamAnswer({
  question,
  response,
  onSelectOption,
  onTextAnswer,
  onNumericalAnswer,
  disabled = false,
}: ExamAnswerProps) {
  const type = question.question_type?.code;

  if (type === "text_answer") {
    return (
      <label className="grid gap-2">
        <span className="exam-eyebrow">Your answer</span>
        <textarea
          value={response?.text_answer ?? ""}
          onChange={(event) => onTextAnswer(event.target.value)}
          rows={5}
          maxLength={2000}
          disabled={disabled}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[0.9375rem] leading-7 text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Type your answer here"
        />
        <span className="text-xs text-muted-foreground">
          {(response?.text_answer?.length ?? 0).toString()}/2000 characters
        </span>
      </label>
    );
  }

  if (type === "numerical") {
    return (
      <label className="grid gap-2">
        <span className="exam-eyebrow">Your answer</span>
        <input
          type="number"
          step="any"
          inputMode="decimal"
          value={response?.numerical_answer ?? ""}
          onChange={(event) => onNumericalAnswer(event.target.value)}
          disabled={disabled}
          className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2.5 text-[0.9375rem] text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Enter a numerical answer"
        />
      </label>
    );
  }

  const isMultiple = type === "multiple_correct";
  const options = question.options ?? [];

  return (
    <fieldset className="grid gap-2.5">
      <legend className="sr-only">
        {isMultiple
          ? `Select all correct options for question ${question.id}`
          : `Choose one answer for question ${question.id}`}
      </legend>
      {isMultiple && (
        <p className="text-xs font-medium text-muted-foreground">
          This is a multiple-answer question. Select every option that applies.
        </p>
      )}
      {options.map((option, index) => {
        const selected = Boolean(response?.selected_option_ids?.includes(option.id));
        return (
          <label
            key={option.id}
            className="exam-option"
            data-selected={selected}
            data-option-id={option.id}
          >
            <input
              type={isMultiple ? "checkbox" : "radio"}
              name={`question-${question.id}`}
              checked={selected}
              disabled={disabled}
              onChange={() => onSelectOption(option.id)}
              className="sr-only"
            />
            <span className="exam-option__marker" aria-hidden="true">
              {OPTION_LABELS[index] ?? index + 1}
            </span>
            <span className="exam-option__body">
              {option.image_url && (
                <img
                  src={option.image_url}
                  alt=""
                  className="mb-2 max-h-40 rounded-md border border-border object-contain"
                />
              )}
              {option.option_text}
            </span>
            <span className="sr-only">
              {selected ? "Selected" : "Not selected"}
              {isMultiple ? "" : " radio option"}
            </span>
          </label>
        );
      })}
      {!options.length && (
        <p className={cn("text-sm text-muted-foreground")}>
          No answer options are available for this question.
        </p>
      )}
    </fieldset>
  );
}
