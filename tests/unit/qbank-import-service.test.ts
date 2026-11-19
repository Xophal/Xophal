import { describe, expect, it } from "vitest";
import {
  autoDetectMapping,
  detectFileType,
  normalizeText,
  parseFile,
  similarityScore,
  validateImportRow,
} from "@/lib/qbank/import-service";
import { ColumnMappingSchema } from "@/lib/qbank/validation";

const MAPPING = ColumnMappingSchema.parse({
  question: "question",
  option_a: "option_a",
  option_b: "option_b",
  correct_answer: "correct_answer",
  question_type: "question_type",
  difficulty: "difficulty",
});

describe("question bank import", () => {
  it("only identifies CSV and ZIP-backed XLSX, not legacy XLS", () => {
    expect(detectFileType(Buffer.from("question"), "questions.csv")).toBe("CSV");
    expect(detectFileType(Buffer.from([0x50, 0x4b, 0x03, 0x04]), "questions.xlsx")).toBe("XLSX");
    expect(detectFileType(Buffer.from("old excel"), "questions.xls")).toBeNull();
    expect(detectFileType(Buffer.from("MZ executable"), "questions.csv")).toBeNull();
  });

  it("rejects CSV content with invalid UTF-8", async () => {
    await expect(parseFile(Buffer.from([0xc3, 0x28]), "questions.csv"))
      .rejects.toMatchObject({ code: "INVALID_ENCODING" });
  });

  it("maps common headers without changing the source header spelling", () => {
    expect(autoDetectMapping(["Question Text", "OPTION_A", "ans"])).toEqual({
      question: "Question Text",
      option_a: "OPTION_A",
      correct_answer: "ans",
    });
  });

  it("accepts multiple-correct answers and rejects an invalid correct label", () => {
    const valid = validateImportRow({
      question: "Select prime numbers",
      option_a: "2",
      option_b: "4",
      correct_answer: "A",
      question_type: "multiple_correct",
      difficulty: "medium",
    }, MAPPING, 2, { difficulty: "easy", language: "en" });
    expect(valid.valid).toBe(true);
    expect(valid.data.options.filter((option) => option.is_correct).map((option) => option.label)).toEqual(["A"]);

    const invalid = validateImportRow({
      question: "Select prime numbers",
      option_a: "2",
      option_b: "4",
      correct_answer: "C",
      question_type: "single_correct",
      difficulty: "medium",
    }, MAPPING, 3, { difficulty: "easy", language: "en" });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors).toContain("Exactly one listed option must be correct");
  });

  it("normalizes Unicode question text and detects exact or near duplicates", () => {
    expect(normalizeText("  Énergie—solaire!  ")).toBe("énergie solaire");
    expect(similarityScore("What is photosynthesis?", "what is photosynthesis")).toBe(1);
    expect(similarityScore("Photosynthesis process", "Photosynthesis process in plants")).toBeGreaterThanOrEqual(0.5);
  });
});
