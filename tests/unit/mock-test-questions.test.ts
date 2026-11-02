import { describe, expect, it } from "vitest";
import { sanitizeMockTestAttemptQuestion } from "@/lib/mock-test-questions";

describe("sanitizeMockTestAttemptQuestion", () => {
  it("returns display fields without answer keys or review material", () => {
    const result = sanitizeMockTestAttemptQuestion({
      id: "question-1",
      question_text: "Which option is correct?",
      explanation: "The answer is B.",
      answer_json: { correct_option: "B" },
      correct_option_ids: ["option-b"],
      question_type: { code: "single_correct" },
      options: [
        {
          id: "option-a",
          option_text: "A",
          is_correct: false,
          answer_json: { correct: false },
        },
        {
          id: "option-b",
          option_text: "B",
          is_correct: true,
        },
      ],
    }, 2, 0.5);

    expect(result).toEqual({
      id: "question-1",
      question_text: "Which option is correct?",
      image_url: null,
      question_type: { code: "single_correct" },
      marks: 2,
      negative_marks: 0.5,
      options: [
        {
          id: "option-a",
          option_text: "A",
          image_url: null,
          sort_order: null,
          label: null,
          body: null,
          position: null,
        },
        {
          id: "option-b",
          option_text: "B",
          image_url: null,
          sort_order: null,
          label: null,
          body: null,
          position: null,
        },
      ],
    });
  });

  it("supports legacy option snapshots while ignoring malformed options", () => {
    const result = sanitizeMockTestAttemptQuestion({
      question_options: [
        { id: "option-a", body: "A", is_correct: true },
        null,
        "invalid",
      ],
    }, 1, 0);

    expect(result.options).toHaveLength(1);
    expect(result.options[0]).toMatchObject({
      id: "option-a",
      option_text: "A",
    });
    expect(result.options[0]).not.toHaveProperty("is_correct");
  });
});
