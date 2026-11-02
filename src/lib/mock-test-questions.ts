type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function sanitizeMockTestAttemptQuestion(
  snapshot: unknown,
  marks: number,
  negativeMarks: number
) {
  const question = isRecord(snapshot) ? snapshot : {};
  const questionType = isRecord(question.question_type) ? question.question_type : {};
  const rawOptions = Array.isArray(question.options)
    ? question.options
    : Array.isArray(question.question_options)
      ? question.question_options
      : [];

  return {
    id: stringOrNull(question.id),
    question_text: stringOrNull(question.question_text) ?? "",
    image_url: stringOrNull(question.image_url),
    question_type: {
      code: stringOrNull(questionType.code),
    },
    marks,
    negative_marks: negativeMarks,
    options: rawOptions.filter(isRecord).map((option) => ({
      id: stringOrNull(option.id),
      option_text: stringOrNull(option.option_text) ?? stringOrNull(option.body) ?? "",
      image_url: stringOrNull(option.image_url),
      sort_order: typeof option.sort_order === "number" ? option.sort_order : null,
      label: stringOrNull(option.label),
      body: stringOrNull(option.body),
      position: typeof option.position === "number" ? option.position : null,
    })),
  };
}
