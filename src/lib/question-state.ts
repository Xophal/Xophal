import type { TestResponse } from "@/types";

export type QuestionStatus = {
  isAnswered: boolean;
  isMarkedForReview: boolean;
  isUnanswered: boolean;
  isCurrent: boolean;
};

type QuestionStateLike = Partial<TestResponse> & {
  selected_option_ids?: string[] | null;
  text_answer?: string | null;
  numerical_answer?: number | null;
  is_review_later?: boolean;
};

export function getQuestionStatus(
  response?: QuestionStateLike | null,
  isCurrent = false
): QuestionStatus {
  const hasChoiceAnswer = Array.isArray(response?.selected_option_ids)
    ? response.selected_option_ids.length > 0
    : false;
  const hasTextAnswer = typeof response?.text_answer === "string" && response.text_answer.trim().length > 0;
  const hasNumericAnswer = typeof response?.numerical_answer === "number" && Number.isFinite(response.numerical_answer);
  const isAnswered = hasChoiceAnswer || hasTextAnswer || hasNumericAnswer;

  return {
    isAnswered,
    isMarkedForReview: Boolean(response?.is_review_later),
    isUnanswered: !isAnswered,
    isCurrent,
  };
}

export function getQuestionStatusLabel(status: Pick<QuestionStatus, "isAnswered" | "isMarkedForReview" | "isCurrent">): string {
  if (status.isCurrent && status.isAnswered && status.isMarkedForReview) {
    return "current, answered, marked for review";
  }

  if (status.isCurrent && status.isAnswered) {
    return "current, answered";
  }

  if (status.isCurrent && status.isMarkedForReview) {
    return "current, marked for review";
  }

  if (status.isAnswered && status.isMarkedForReview) {
    return "answered, marked for review";
  }

  if (status.isAnswered) {
    return "answered";
  }

  if (status.isMarkedForReview) {
    return "marked for review";
  }

  if (status.isCurrent) {
    return "current";
  }

  return "unanswered";
}
