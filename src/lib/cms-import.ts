import { type ImportFormat } from "@/types";

export type ImportIssue = {
  rowIndex: number;
  field?: string;
  message: string;
  severity: "error" | "warning";
};

export interface ImportPreviewResult {
  entityType: string;
  format: ImportFormat;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateCount: number;
  previewRows: unknown[];
  issues: ImportIssue[];
}

const entityTypeMap: Record<string, string> = {
  board: "boards",
  boards: "boards",
  class: "classes",
  classes: "classes",
  subject: "subjects",
  subjects: "subjects",
  chapter: "chapters",
  chapters: "chapters",
  topic: "topics",
  topics: "topics",
  lesson: "lessons",
  lessons: "lessons",
  question: "questions",
  questions: "questions",
  note: "notes",
  notes: "notes",
  mock_test: "mock_tests",
  mock_tests: "mock_tests",
};

const requiredFieldsByEntity: Record<string, string[]> = {
  boards: ["code", "name"],
  classes: ["board_id", "code", "name"],
  subjects: ["class_id", "code", "name"],
  chapters: ["subject_id", "code", "name"],
  topics: ["chapter_id", "code", "name"],
  lessons: ["topic_id", "code", "title", "content"],
  questions: ["question_text", "question_type", "topic_id"],
  notes: ["title", "content"],
  mock_tests: ["title", "type"],
};

const duplicateKeyCandidates: Record<string, string[]> = {
  boards: ["code", "name"],
  classes: ["code", "name"],
  subjects: ["code", "name"],
  chapters: ["code", "name"],
  topics: ["code", "name"],
  lessons: ["code", "title"],
  questions: ["question_text"],
  notes: ["title"],
  mock_tests: ["title"],
};

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

export function parseCsvRows(csv: string) {
  const normalizedCsv = csv.replace(/\r\n/g, "\n").trim();
  if (!normalizedCsv) return [];

  const lines = normalizedCsv.split("\n");
  const headerFields = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());

  return lines.slice(1).reduce<Record<string, unknown>[]>((rows, line) => {
    if (!line.trim()) return rows;
    const values = parseCsvLine(line);
    const row: Record<string, unknown> = {};
    for (let i = 0; i < headerFields.length; i++) {
      row[headerFields[i]] = values[i] !== undefined ? values[i].trim() : "";
    }
    rows.push(row);
    return rows;
  }, []);
}

function normalizeRowKeys(row: Record<string, unknown>) {
  return Object.entries(row).reduce<Record<string, unknown>>((normalized, [key, value]) => {
    normalized[key.trim().toLowerCase()] = value;
    return normalized;
  }, {});
}

function isEmptyValue(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function validateImportRows(entityType: string, rows: unknown[]): ImportPreviewResult {
  const normalizedType = entityTypeMap[entityType.trim().toLowerCase()] || entityType.trim().toLowerCase();
  const requiredFields = requiredFieldsByEntity[normalizedType] ?? [];
  const duplicateCandidates = duplicateKeyCandidates[normalizedType] ?? [];

  const issues: ImportIssue[] = [];
  const duplicateTracker: Record<string, Set<string>> = {};
  const previewRows: unknown[] = [];
  let validRows = 0;
  let invalidRows = 0;
  let duplicateCount = 0;

  rows.forEach((item, index) => {
    if (typeof item !== "object" || item === null) {
      issues.push({ rowIndex: index, message: "Row must be an object", severity: "error" });
      invalidRows += 1;
      return;
    }

    const row = normalizeRowKeys(item as Record<string, unknown>);
    const rowErrors: ImportIssue[] = [];

    for (const field of requiredFields) {
      if (isEmptyValue(row[field])) {
        rowErrors.push({
          rowIndex: index,
          field,
          message: `${field} is required for ${normalizedType}`,
          severity: "error",
        });
      }
    }

    duplicateCandidates.forEach((field) => {
      const value = String(row[field] ?? "").trim().toLowerCase();
      if (!value) return;
      duplicateTracker[field] ??= new Set();
      if (duplicateTracker[field].has(value)) {
        duplicateCount += 1;
        rowErrors.push({
          rowIndex: index,
          field,
          message: `Duplicate ${field} value detected in import payload: ${String(row[field])}`,
          severity: "warning",
        });
      } else {
        duplicateTracker[field].add(value);
      }
    });

    if (rowErrors.length > 0) {
      issues.push(...rowErrors);
      invalidRows += 1;
    } else {
      validRows += 1;
    }

    if (previewRows.length < 20) {
      previewRows.push(row);
    }
  });

  return {
    entityType: normalizedType,
    format: "JSON",
    totalRows: rows.length,
    validRows,
    invalidRows,
    duplicateCount,
    previewRows,
    issues,
  };
}
