import { describe, expect, it } from "vitest";
import { getQuestionStatus, getQuestionStatusLabel } from "@/lib/question-state";

describe("question palette status model", () => {
  it("classifies answered, review, and answered+review states correctly", () => {
    expect(
      getQuestionStatus({
        selected_option_ids: ["a"],
        text_answer: null,
        numerical_answer: null,
        is_review_later: false,
      })
    ).toEqual({ isAnswered: true, isMarkedForReview: false, isUnanswered: false, isCurrent: false });

    expect(
      getQuestionStatus({
        selected_option_ids: null,
        text_answer: null,
        numerical_answer: null,
        is_review_later: true,
      })
    ).toEqual({ isAnswered: false, isMarkedForReview: true, isUnanswered: true, isCurrent: false });

    expect(
      getQuestionStatus({
        selected_option_ids: ["a"],
        text_answer: null,
        numerical_answer: null,
        is_review_later: true,
      })
    ).toEqual({ isAnswered: true, isMarkedForReview: true, isUnanswered: false, isCurrent: false });
  });

  it("treats text and numerical responses as answers, while blank text remains unanswered", () => {
    expect(getQuestionStatus({ text_answer: "A written response" }).isAnswered).toBe(true);
    expect(getQuestionStatus({ numerical_answer: 0 }).isAnswered).toBe(true);
    expect(getQuestionStatus({ text_answer: "   " }).isUnanswered).toBe(true);
  });

  it("builds accessible labels for each question state", () => {
    expect(getQuestionStatusLabel({ isAnswered: true, isMarkedForReview: true, isCurrent: false })).toBe(
      "answered, marked for review"
    );
    expect(getQuestionStatusLabel({ isAnswered: false, isMarkedForReview: true, isCurrent: true })).toBe(
      "current, marked for review"
    );
    expect(getQuestionStatusLabel({ isAnswered: false, isMarkedForReview: false, isCurrent: false })).toBe(
      "unanswered"
    );
  });
});
