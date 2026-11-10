type RelatedQuestionType = { code: string } | { code: string }[] | null;
type QuestionOption = { is_correct: boolean; option_text: string | null };

export type MockTestQuestionReadinessInput = {
  status: string;
  is_active: boolean;
  question_types: RelatedQuestionType;
  question_options: QuestionOption[] | null;
};

export function isUsableMockTestQuestion(question: MockTestQuestionReadinessInput) {
  const type = Array.isArray(question.question_types)
    ? question.question_types[0]?.code
    : question.question_types?.code;
  const options = question.question_options ?? [];
  const correctCount = options.filter((option) => option.is_correct).length;
  return question.status === "published"
    && question.is_active
    && (type === "single_correct" || type === "multiple_correct")
    && options.length >= 2
    && options.every((option) => option.option_text?.trim())
    && correctCount >= 1
    && (type === "multiple_correct" || correctCount === 1);
}
