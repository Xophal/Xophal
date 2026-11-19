import type { SupabaseClient } from "@supabase/supabase-js";
import * as ExcelJS from "exceljs";
import { ApiError } from "@/lib/api-utils";
import { parseCsvRows } from "@/lib/engine/question-schema";
import type { ColumnMapping, StartImportInput } from "./validation";

type Admin = SupabaseClient;

export const MAX_FILE_SIZE_MB = 10;
export const MAX_ROWS_PER_IMPORT = 5000;
export const BATCH_SIZE = 50;

export async function parseXlsxFile(buffer: Buffer): Promise<Array<Record<string, string>>> {
  const workbook = new ExcelJS.Workbook();
  try {
    const bytes = Uint8Array.from(buffer);
    await workbook.xlsx.load(bytes.buffer);
  } catch {
    throw new ApiError(400, "The XLSX workbook could not be read.", "INVALID_WORKBOOK");
  }
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new ApiError(400, "XLSX file has no worksheets.", "NO_WORKSHEET");

  const headers: string[] = [];
  const rows: Array<Record<string, string>> = [];
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber > MAX_ROWS_PER_IMPORT + 1) {
      throw new ApiError(400, `The import is limited to ${MAX_ROWS_PER_IMPORT} data rows.`, "TOO_MANY_ROWS");
    }
    if (rowNumber === 1) {
      for (let column = 1; column <= row.cellCount; column++) {
        headers.push(String(row.getCell(column).value ?? "").trim());
      }
      return;
    }
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      const value = row.getCell(index + 1).value;
      if (value && typeof value === "object") {
        throw new ApiError(400, `Formula or rich-text cells are not supported (row ${rowNumber}).`, "UNSUPPORTED_CELL");
      }
      record[header] = value == null ? "" : String(value);
    });
    if (Object.values(record).some((value) => value.trim())) rows.push(record);
  });
  return rows;
}

export function detectFileType(buffer: Buffer, filename: string): "CSV" | "XLSX" | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) {
    const executableMagic =
      (buffer[0] === 0x4d && buffer[1] === 0x5a)
      || (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46);
    return executableMagic ? null : "CSV";
  }
  if (lower.endsWith(".xlsx") && buffer[0] === 0x50 && buffer[1] === 0x4b) return "XLSX";
  return null;
}

export async function parseFile(
  buffer: Buffer,
  filename: string
): Promise<{ format: "CSV" | "XLSX"; rows: Array<Record<string, string>>; headers: string[] }> {
  if (buffer.length === 0) throw new ApiError(400, "The uploaded file is empty.", "EMPTY_FILE");
  if (buffer.length > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new ApiError(413, `File exceeds the ${MAX_FILE_SIZE_MB} MB limit.`, "FILE_TOO_LARGE");
  }
  const format = detectFileType(buffer, filename);
  if (!format) throw new ApiError(400, "Use a valid CSV or XLSX file.", "UNSUPPORTED_FILE");

  let rows: Array<Record<string, string>>;
  if (format === "CSV") {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      throw new ApiError(400, "CSV files must use UTF-8 encoding.", "INVALID_ENCODING");
    }
    rows = parseCsvRows(text);
  } else {
    rows = await parseXlsxFile(buffer);
  }
  if (!rows.length) throw new ApiError(400, "No data rows found in the file.", "NO_DATA_ROWS");
  if (rows.length > MAX_ROWS_PER_IMPORT) {
    throw new ApiError(400, `The import is limited to ${MAX_ROWS_PER_IMPORT} data rows.`, "TOO_MANY_ROWS");
  }
  return { format, rows, headers: Object.keys(rows[0]) };
}

const HEADER_ALIASES: Record<keyof ColumnMapping, string[]> = {
  question: ["question", "question_text", "stem", "questiontext"],
  option_a: ["option_a", "option1", "a", "opt_a"],
  option_b: ["option_b", "option2", "b", "opt_b"],
  option_c: ["option_c", "option3", "c", "opt_c"],
  option_d: ["option_d", "option4", "d", "opt_d"],
  option_e: ["option_e", "option5", "e", "opt_e"],
  option_f: ["option_f", "option6", "f", "opt_f"],
  correct_answer: ["correct_answer", "correct", "answer", "correct_option", "ans"],
  explanation: ["explanation", "answer_explanation", "solution"],
  chapter: ["chapter", "chapter_name", "chapter_title"],
  topic: ["topic", "topic_name", "topic_title"],
  difficulty: ["difficulty", "difficulty_level"],
  marks: ["marks", "mark", "score", "points"],
  negative_marks: ["negative_marks", "neg_marks", "negative_mark"],
  language: ["language", "lang"],
  question_type: ["question_type", "type", "qtype"],
};

export function autoDetectMapping(headers: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};
  const normalizeHeader = (header: string) => header.trim().toLowerCase().replace(/[\s_-]/g, "");
  const headerLookup = new Map(headers.map((header) => [normalizeHeader(header), header]));
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<[keyof ColumnMapping, string[]]>) {
    const header = aliases.map((alias) => headerLookup.get(normalizeHeader(alias))).find(Boolean);
    if (header) mapping[field] = header;
  }
  return mapping;
}

export interface ValidatedRow {
  rowNo: number;
  valid: boolean;
  errors: string[];
  data: {
    question_text: string;
    options: Array<{ label: string; body: string; is_correct: boolean; position: number }>;
    correct_answer: string[];
    explanation: string;
    chapter?: string;
    topic?: string;
    difficulty: string;
    marks: number;
    negative_marks: number;
    language: string;
    question_type: string;
  };
}

export function validateImportRow(
  row: Record<string, string>,
  mapping: ColumnMapping,
  rowNo: number,
  defaults: { difficulty: string; language: string }
): ValidatedRow {
  const errors: string[] = [];
  const get = (field: keyof ColumnMapping) => {
    const header = mapping[field];
    return header ? String(row[header] ?? "").trim() : "";
  };
  const questionText = get("question");
  const questionType = (get("question_type") || "single_correct").toLowerCase();
  const allowedTypes = new Set([
    "single_correct",
    "multiple_correct",
    "true_false",
    "fill_blank",
    "match_following",
    "numerical",
  ]);
  if (!questionText) errors.push("Missing question text");
  if (questionText.length > 12000) errors.push("Question text exceeds 12,000 characters");
  if (!allowedTypes.has(questionType)) errors.push(`Unsupported question type: ${questionType}`);

  const rawCorrect = get("correct_answer");
  const correctAnswers = rawCorrect.split(/[;,|]/).map((value) => value.trim()).filter(Boolean);
  const labels = ["A", "B", "C", "D", "E", "F"];
  const fields: Array<keyof ColumnMapping> = ["option_a", "option_b", "option_c", "option_d", "option_e", "option_f"];
  const rawOptions = fields.map((field, index) => ({ label: labels[index], body: get(field), position: index + 1 })).filter((option) => option.body);
  const normalizedCorrect = correctAnswers.map((value) => value.toLocaleLowerCase());
  const options = rawOptions.map((option) => ({
    ...option,
    is_correct: normalizedCorrect.includes(option.label.toLowerCase())
      || normalizedCorrect.includes(option.body.toLocaleLowerCase()),
  }));
  if (options.some((option) => option.body.length > 5000)) errors.push("An option exceeds 5,000 characters");
  const correctCount = options.filter((option) => option.is_correct).length;
  const requiredCorrect = questionType === "multiple_correct" ? correctCount > 0 : correctCount === 1;
  if (["single_correct", "multiple_correct", "true_false", "match_following"].includes(questionType) && options.length < 2) {
    errors.push("At least two options are required");
  }
  if (!rawCorrect) errors.push("Missing correct answer");
  else if (["single_correct", "multiple_correct", "true_false"].includes(questionType) && !requiredCorrect) {
    errors.push(questionType === "multiple_correct"
      ? "At least one listed option must be correct"
      : "Exactly one listed option must be correct");
  }
  if (questionType === "true_false" && options.length !== 2) errors.push("True/False questions require exactly two options");

  const numberField = (field: "marks" | "negative_marks", fallback: number) => {
    const value = get(field);
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      errors.push(`Invalid ${field.replace("_", " ")} value`);
      return fallback;
    }
    return parsed;
  };

  const difficultyValue = (get("difficulty") || defaults.difficulty).toLowerCase();
  const difficulty = ["easy", "medium", "hard"].includes(difficultyValue) ? difficultyValue : "";
  if (!difficulty) errors.push("Difficulty must be easy, medium, or hard");
  if (get("explanation").length > 12000) errors.push("Explanation exceeds 12,000 characters");
  if ((get("language") || defaults.language).length > 10) errors.push("Language code is too long");

  return {
    rowNo,
    valid: errors.length === 0,
    errors,
    data: {
      question_text: questionText,
      options,
      correct_answer: options.filter((option) => option.is_correct).map((option) => option.label),
      explanation: get("explanation"),
      chapter: get("chapter") || undefined,
      topic: get("topic") || undefined,
      difficulty,
      marks: numberField("marks", 1),
      negative_marks: numberField("negative_marks", 0),
      language: get("language") || defaults.language,
      question_type: questionType,
    },
  };
}

export function normalizeText(text: string): string {
  return text.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

export function similarityScore(a: string, b: string): number {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftWords = new Set(left.split(" "));
  const rightWords = new Set(right.split(" "));
  const overlap = [...leftWords].filter((word) => rightWords.has(word)).length;
  return overlap / Math.max(leftWords.size, rightWords.size);
}

export async function findDuplicates(
  admin: Admin,
  rows: ValidatedRow[],
  subjectId: string,
  chapterId?: string | null,
  threshold = 0.9
): Promise<Map<number, { existingId: string; similarity: number }>> {
  let query = admin
    .from("questions")
    .select("id, question_text, stem, chapter_id, question_types(code), chapters(name), question_options(option_text, is_correct)", { count: "exact" })
    .eq("subject_id", subjectId);
  if (chapterId) query = query.eq("chapter_id", chapterId);
  const { data: existing, error, count } = await query.limit(5000);
  if (error) throw new ApiError(500, error.message, "DB_ERROR");
  if ((count ?? 0) > 5000) throw new ApiError(400, "Narrow the import to a chapter with 5,000 or fewer existing questions for duplicate checking.", "DUPLICATE_SCAN_TOO_LARGE");

  const duplicates = new Map<number, { existingId: string; similarity: number }>();
  const existingRows = (existing ?? []) as Array<{
    id: string;
    question_text: string | null;
    stem: string | null;
    chapter_id: string | null;
    chapters: { name: string } | { name: string }[] | null;
    question_types: { code: string } | { code: string }[] | null;
    question_options: Array<{ option_text: string | null; is_correct: boolean }>;
  }>;
  const seen = new Map<string, number>();
  for (const row of rows) {
    if (!row.valid) continue;
    const normalized = normalizeText(row.data.question_text);
    const chapterKey = normalizeText(row.data.chapter || "");
    const sameBatchKey = `${chapterKey}|${row.data.question_type}|${normalized}`;
    const previousRow = seen.get(sameBatchKey);
    if (previousRow !== undefined) {
      duplicates.set(row.rowNo, { existingId: `row:${previousRow}`, similarity: 1 });
      continue;
    }
    seen.set(sameBatchKey, row.rowNo);

    let best: { existingId: string; similarity: number } | null = null;
    for (const rawCandidate of existingRows as Array<Record<string, unknown>>) {
      const candidate = rawCandidate;
      const candidateChapterRelation = candidate.chapters as { name?: unknown } | Array<{ name?: unknown }> | null | undefined;
      const candidateChapter = Array.isArray(candidateChapterRelation)
        ? candidateChapterRelation[0]?.name
        : candidateChapterRelation?.name;
      if (chapterId && candidate.chapter_id !== chapterId) continue;
      if (row.data.chapter && normalizeText(String(candidateChapter ?? "")) !== chapterKey) continue;
      const candidateTypeRelation = candidate.question_types as { code?: unknown } | Array<{ code?: unknown }> | null | undefined;
      const candidateType = Array.isArray(candidateTypeRelation)
        ? candidateTypeRelation[0]?.code
        : candidateTypeRelation?.code;
      if (candidateType && String(candidateType) !== row.data.question_type) continue;
      const candidateQuestionText = String(candidate.question_text ?? candidate.stem ?? "");
      const score = similarityScore(row.data.question_text, candidateQuestionText);
      if (score < threshold) continue;
      const candidateOptions = Array.isArray(candidate.question_options)
        ? candidate.question_options as Array<{ option_text: string | null; is_correct: boolean }>
        : [];
      const existingOptions = candidateOptions
        .map((option: { option_text: string | null; is_correct: boolean }) => `${normalizeText(option.option_text ?? "")}:${option.is_correct}`)
        .sort();
      const importedOptions = row.data.options.map((option) => `${normalizeText(option.body)}:${option.is_correct}`).sort();
      if (existingOptions.length && (existingOptions.length !== importedOptions.length
        || existingOptions.some((option: string, index: number) => option !== importedOptions[index]))) continue;
      if (!best || score > best.similarity) best = { existingId: String(candidate.id), similarity: score };
    }
    if (best) duplicates.set(row.rowNo, best);
  }
  return duplicates;
}

export interface ImportResult {
  batchId: string;
  totalRows: number;
  imported: number;
  failed: number;
  skipped: number;
  duplicates: number;
  errors: Array<{ rowNo: number; errors: string[] }>;
}

export async function executeImport(
  admin: Admin,
  userId: string,
  batchId: string,
  rows: ValidatedRow[],
  duplicates: Map<number, { existingId: string; similarity: number }>,
  input: StartImportInput
): Promise<ImportResult> {
  if (input.duplicate_policy === "update_after_review" && duplicates.size) {
    throw new ApiError(409, "Existing questions are never overwritten by bulk import. Review and update duplicates individually.", "DUPLICATE_UPDATE_REQUIRES_REVIEW");
  }
  const invalidRows = rows.filter((row) => !row.valid);
  if (invalidRows.length && !input.skip_invalid) {
    throw new ApiError(400, `Row ${invalidRows[0].rowNo}: ${invalidRows[0].errors.join(", ")}`, "VALIDATION_FAILED");
  }

  const status = input.default_status === "pending_review" ? "review" : input.default_status;
  let duplicateCount = 0;
  const errors: ImportResult["errors"] = [];
  const chapterIds = new Map<string, string>();
  const topicIds = new Map<string, string>();
  const rpcRows: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    if (!row.valid) {
      errors.push({ rowNo: row.rowNo, errors: row.errors });
      continue;
    }
    const duplicate = duplicates.get(row.rowNo);
    if (duplicate) {
      duplicateCount++;
      if (input.duplicate_policy === "skip") {
        continue;
      }
    }
    try {
      const chapterId = await resolveChapter(admin, row.data.chapter, input.chapter_id, input.topic_id, input.subject_id, chapterIds);
      const topicId = await resolveTopic(admin, row.data.topic, input.topic_id, chapterId, topicIds);
      rpcRows.push({
        row_no: row.rowNo,
        subject_id: input.subject_id,
        chapter_id: chapterId,
        topic_id: topicId,
        question_type: row.data.question_type,
        question_text: row.data.question_text,
        explanation: row.data.explanation,
        language: row.data.language,
        difficulty: row.data.difficulty,
        marks: row.data.marks,
        negative_marks: row.data.negative_marks,
        time_seconds: 60,
        status: status === "approved" ? "approved" : status === "draft" ? "draft" : "review",
        options: row.data.options,
      });
    } catch (error) {
      errors.push({
        rowNo: row.rowNo,
        errors: [error instanceof Error ? error.message : "Question import failed"],
      });
    }
  }

  if (rpcRows.length) {
    const preRpcErrorCount = errors.length;
    const { data, error } = await admin.rpc("import_question_batch", {
      p_batch_id: batchId,
      p_actor_id: userId,
      p_rows: rpcRows,
    });
    if (error) throw new ApiError(500, error.message, "IMPORT_RPC_FAILED");
    const rpcResult = data as {
      imported?: number;
      failed?: number;
      skipped?: number;
      errors?: Array<{ rowNo: number; errors: string[] }> | null;
    } | null;
    const rpcErrors = Array.isArray(rpcResult?.errors) ? rpcResult.errors : [];
    errors.push(...rpcErrors);
    const rpcImported = rpcResult?.imported ?? 0;
    const rpcFailed = rpcResult?.failed ?? 0;
    const rpcSkipped = rpcResult?.skipped ?? 0;
    return {
      batchId,
      totalRows: rows.length,
      imported: rpcImported,
      failed: preRpcErrorCount + rpcFailed,
      skipped: rpcSkipped + (input.duplicate_policy === "skip" ? duplicateCount : 0),
      duplicates: duplicateCount,
      errors,
    };
  }

  return {
    batchId,
    totalRows: rows.length,
    imported: 0,
    failed: errors.length,
    skipped: input.duplicate_policy === "skip" ? duplicateCount : 0,
    duplicates: duplicateCount,
    errors,
  };
}

async function resolveChapter(
  admin: Admin,
  chapterName: string | undefined,
  defaultId: string | null | undefined,
  defaultTopicId: string | null | undefined,
  subjectId: string,
  cache: Map<string, string>
): Promise<string> {
  if (!chapterName) {
    if (defaultId) return defaultId;
    if (defaultTopicId) {
      const { data, error } = await admin.from("topics").select("chapter_id").eq("id", defaultTopicId).maybeSingle();
      if (error) throw new ApiError(500, error.message, "DB_ERROR");
      if (data?.chapter_id) return data.chapter_id;
    }
    throw new ApiError(400, "No chapter was provided and no default chapter is selected.", "CHAPTER_REQUIRED");
  }
  const key = chapterName.toLocaleLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;
  const { data, error } = await admin.from("chapters").select("id").eq("subject_id", subjectId).ilike("name", chapterName).maybeSingle();
  if (error) throw new ApiError(500, error.message, "DB_ERROR");
  if (!data) throw new ApiError(400, `Unknown chapter '${chapterName}'.`, "UNKNOWN_CHAPTER");
  cache.set(key, data.id);
  return data.id;
}

async function resolveTopic(
  admin: Admin,
  topicName: string | undefined,
  defaultId: string | null | undefined,
  chapterId: string,
  cache: Map<string, string>
): Promise<string> {
  if (!topicName) {
    if (!defaultId) throw new ApiError(400, "No topic was provided and no default topic is selected.", "TOPIC_REQUIRED");
    const { data, error } = await admin.from("topics").select("chapter_id").eq("id", defaultId).maybeSingle();
    if (error) throw new ApiError(500, error.message, "DB_ERROR");
    if (data?.chapter_id !== chapterId) throw new ApiError(400, "The default topic does not belong to the selected chapter.", "INVALID_TAXONOMY");
    return defaultId;
  }
  const key = `${chapterId}:${topicName.toLocaleLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const { data, error } = await admin.from("topics").select("id").eq("chapter_id", chapterId).ilike("name", topicName).maybeSingle();
  if (error) throw new ApiError(500, error.message, "DB_ERROR");
  if (!data) throw new ApiError(400, `Unknown topic '${topicName}'.`, "UNKNOWN_TOPIC");
  cache.set(key, data.id);
  return data.id;
}
