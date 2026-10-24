import { describe, expect, it } from "vitest";
import { validateQuestionImportRows } from "@/lib/admin/question-bank-import";

const validQuestion = {
  question: "Which gas turns limewater milky?",
  option_a: "Oxygen",
  option_b: "Carbon dioxide",
  option_c: "Hydrogen",
  option_d: "Nitrogen",
  correct_answer: "B",
  marks: "1",
  negative_marks: "0.25",
  time_seconds: "60",
};

describe("question bank spreadsheet import", () => {
  it("accepts the simple four-option format and defaults to a single-correct MCQ", () => {
    const preview = validateQuestionImportRows([validQuestion]);
    expect(preview.issues).toEqual([]);
    expect(preview.validRows).toBe(1);
    expect(preview.rows[0]).toMatchObject({
      question: validQuestion.question,
      type: "single_correct",
      marks: 1,
      negative_marks: 0.25,
      time_seconds: 60,
      correctAnswers: ["B"],
    });
  });

  it("supports case-insensitive headers and multiple correct answers", () => {
    const preview = validateQuestionImportRows([{
      Question: "Select the prime numbers",
      Option_A: "2",
      Option_B: "4",
      Option_C: "5",
      Option_D: "9",
      Correct_Answer: "a|C",
      Marks: "2",
      Negative_Marks: "0",
      Time_Seconds: "45",
      Type: "multiple_correct",
    }]);
    expect(preview.issues).toEqual([]);
    expect(preview.rows[0].correctAnswers).toEqual(["A", "C"]);
  });

  it("rejects missing options, missing required scoring fields, and times above one minute", () => {
    const preview = validateQuestionImportRows([{
      ...validQuestion,
      option_d: "",
      time_seconds: "61",
      negative_marks: "",
    }]);
    expect(preview.validRows).toBe(0);
    expect(preview.issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(["option_d", "time_seconds", "negative_marks"])
    );
  });

  it("requires multiple_correct when the answer key contains more than one option", () => {
    const preview = validateQuestionImportRows([{ ...validQuestion, correct_answer: "A|C" }]);
    expect(preview.validRows).toBe(0);
    expect(preview.issues).toContainEqual(expect.objectContaining({
      field: "correct_answer",
      message: "Multiple correct answers require type=multiple_correct.",
    }));
  });
});
