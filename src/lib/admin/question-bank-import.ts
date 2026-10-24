import { z } from "zod";
import { parseCsvRows } from "@/lib/engine/question-schema";

export const BANK_QUESTION_TYPES = [
  "single_correct",
  "multiple_correct",
  "assertion_reason",
  "case_study",
  "diagram_based",
  "match_following",
  "true_false",
] as const;

export type BankQuestionType = (typeof BANK_QUESTION_TYPES)[number];

const bankRowSchema = z.object({
  question: z.string().trim().min(1).max(12000),
  option_a: z.string().trim().min(1).max(5000),
  option_b: z.string().trim().min(1).max(5000),
  option_c: z.string().trim().min(1).max(5000),
  option_d: z.string().trim().min(1).max(5000),
  correct_answer: z.string().trim().min(1).max(20),
  marks: z.coerce.number().finite().positive().max(100),
  negative_marks: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().finite().min(0).max(100)
  ),
  time_seconds: z.coerce.number().int().min(1).max(60),
  type: z.enum(BANK_QUESTION_TYPES).optional().default("single_correct"),
  explanation: z.string().trim().max(12000).optional().default(""),
});

export type BankQuestionImportRow = z.infer<typeof bankRowSchema> & {
  correctAnswers: string[];
};

export type QuestionImportIssue = { row: number; field: string; message: string };

const ALIASES: Record<string, string> = {
  stem: "question",
  question_text: "question",
  option1: "option_a",
  option2: "option_b",
  option3: "option_c",
  option4: "option_d",
  answer: "correct_answer",
  correct_option: "correct_answer",
  negative_marking: "negative_marks",
  neg_marks: "negative_marks",
  time: "time_seconds",
  est_time_sec: "time_seconds",
  question_type: "type",
};

export function normalizeQuestionImportRow(row: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(row)) {
    const key = rawKey.trim().toLowerCase().replace(/[\s-]+/g, "_");
    normalized[ALIASES[key] ?? key] = typeof value === "string" ? value.trim() : value;
  }
  return normalized;
}

export function validateQuestionImportRows(rawRows: Record<string, unknown>[]) {
  const rows: BankQuestionImportRow[] = [];
  const issues: QuestionImportIssue[] = [];

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2;
    const parsed = bankRowSchema.safeParse(normalizeQuestionImportRow(raw));
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({
          row: rowNumber,
          field: issue.path.join(".") || "row",
          message: issue.message,
        });
      }
      return;
    }

    const correctAnswers = parsed.data.correct_answer
      .toUpperCase()
      .split(/[|;]/)
      .map((answer) => answer.trim())
      .filter(Boolean);
    const uniqueAnswers = [...new Set(correctAnswers)];
    if (!uniqueAnswers.length || uniqueAnswers.some((answer) => !["A", "B", "C", "D"].includes(answer))) {
      issues.push({ row: rowNumber, field: "correct_answer", message: "Use A, B, C, or D; separate multiple answers with |." });
      return;
    }
    if (uniqueAnswers.length > 1 && parsed.data.type !== "multiple_correct") {
      issues.push({ row: rowNumber, field: "correct_answer", message: "Multiple correct answers require type=multiple_correct." });
      return;
    }

    rows.push({ ...parsed.data, correctAnswers: uniqueAnswers });
  });

  return { rows, issues, totalRows: rawRows.length, validRows: rows.length, invalidRows: rawRows.length - rows.length };
}

export async function parseQuestionImportFile(file: File): Promise<Record<string, unknown>[]> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".csv") || file.type === "text/csv") {
    return parseCsvRows(await file.text());
  }

  if (!lowerName.endsWith(".xlsx")) {
    throw new Error("Use a .csv or .xlsx spreadsheet.");
  }

  const excelModule = await import("exceljs");
  const ExcelJS = excelModule.default ?? excelModule;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers = worksheet.getRow(1).values as Array<unknown>;
  const keys = headers.slice(1).map((value) => String(value ?? "").trim());
  const rows: Record<string, unknown>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, unknown> = {};
    keys.forEach((key, index) => {
      if (key) record[key] = row.getCell(index + 1).text;
    });
    if (Object.values(record).some((value) => String(value ?? "").trim())) rows.push(record);
  });
  return rows;
}
