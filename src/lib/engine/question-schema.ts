import { z } from "zod";
import type { EngineType } from "./vocab";
import { ENGINE_BOARDS, ENGINE_SKILLS, ENGINE_SOURCES, ENGINE_STATUSES, ENGINE_TYPES } from "./vocab";

const uuidOrEmpty = z.string().uuid().optional().or(z.literal(""));
const trimTag = z.string().trim().min(1).max(100);

export const engineOptionSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(10).optional(),
  body: z.string().min(0).max(5000).default(""),
  text: z.string().max(5000).optional(),
  isCorrect: z.boolean().optional().default(false),
  is_correct: z.boolean().optional(),
  position: z.number().int().min(0).max(50).optional(),
  sortOrder: z.number().int().min(0).max(50).optional(),
  mediaUrl: z.string().url().optional().or(z.literal("")),
});

export type EngineOptionInput = z.input<typeof engineOptionSchema>;

/** Option after normalisation: exactly the columns written to `question_options`. */
export interface NormalizedEngineOption {
  label: string;
  body: string;
  is_correct: boolean;
  position: number;
}

const matchRowSchema = z.object({
  left: z.string().trim().min(1).max(1000),
  right: z.string().trim().min(1).max(1000),
});

const fillBlankSchema = z.object({
  blank_index: z.number().int().min(0).max(20),
  answers: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  case_sensitive: z.boolean().optional().default(false),
});

export const engineAnswerSchema = z
  .object({
    correct_option: z.string().max(10).optional(),
    correct_options: z.array(z.string().max(10)).max(10).optional(),
    match: z.record(z.string(), z.string()).optional(),
    match_pairs: z.array(matchRowSchema).max(8).optional(),
    blanks: z.array(fillBlankSchema).max(20).optional(),
    accepted: z.array(z.string().max(2000)).max(30).optional(),
    balanced_equation: z.string().max(2000).optional(),
    reactants: z.array(z.string().max(500)).max(20).optional(),
    products: z.array(z.string().max(500)).max(20).optional(),
    value: z.string().max(5000).optional(),
  })
  .partial()
  .default({});

export type EngineAnswerInput = z.infer<typeof engineAnswerSchema>;

export const engineRubricSchema = z
  .object({
    criteria: z
      .array(z.object({ point: z.string().trim().min(1).max(1000), marks: z.number().min(0).max(100) }))
      .max(20)
      .optional(),
    keywords: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
    max_marks: z.number().min(0).max(100).optional(),
    model_answer: z.string().max(8000).optional(),
    notes: z.string().max(4000).optional(),
  })
  .partial()
  .default({});

export type EngineRubricInput = z.infer<typeof engineRubricSchema>;

const assertionSchema = z.object({ assertion: z.string().trim().min(1).max(3000), reason: z.string().trim().min(1).max(3000) }).partial();

export const createEngineQuestionSchema = z.object({
  type: z.enum(ENGINE_TYPES),
  stem: z.string().trim().min(1).max(12000),
  topicId: z.string().uuid(),
  subtopicId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  chapterId: uuidOrEmpty,
  subjectId: uuidOrEmpty,
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  skill: z.enum(ENGINE_SKILLS),
  marks: z.number().min(0).max(100).default(1),
  negMarks: z.number().min(0).max(100).default(0),
  estTimeSec: z.number().int().min(5).max(3600).default(60),
  boardPattern: z.enum(ENGINE_BOARDS).default("CBSE"),
  pyqYear: z.number().int().min(1990).max(2100).nullable().optional(),
  lang: z.string().trim().min(2).max(10).default("en"),
  status: z.enum(ENGINE_STATUSES).default("draft"),
  source: z.enum(ENGINE_SOURCES).default("manual"),
  tags: z.array(trimTag).max(30).optional().default([]),
  options: z.array(engineOptionSchema).max(10).optional().default([]),
  answer: engineAnswerSchema,
  rubric: engineRubricSchema,
  explanation: z.string().max(12000).optional().default(""),
  assertion: assertionSchema.optional(),
  matchPairs: z.array(matchRowSchema).max(8).optional().default([]),
  blanks: z.array(fillBlankSchema).max(20).optional().default([]),
});

export type CreateEngineQuestionParsed = z.infer<typeof createEngineQuestionSchema>;

/**
 * What callers actually hand to the service: the *input* side of the schema,
 * i.e. every field with a `.default()` is still optional. The service applies
 * the defaults itself (see `withEngineDefaults`) so the DB write never sees
 * `undefined` for a defaulted column.
 */
export type CreateEngineQuestionInput = z.input<typeof createEngineQuestionSchema>;

/** Fully-defaulted payload the persistence layer writes. */
export type EngineQuestionDefaults = Omit<CreateEngineQuestionParsed, "chapterId" | "subjectId"> & {
  chapterId: string;
  subjectId: string;
};

const DEFAULTED = createEngineQuestionSchema
  .pick({
    marks: true,
    negMarks: true,
    estTimeSec: true,
    boardPattern: true,
    lang: true,
    status: true,
    source: true,
    tags: true,
    options: true,
    matchPairs: true,
    blanks: true,
    answer: true,
    rubric: true,
    explanation: true,
  })
  .parse({});

/**
 * Applies schema defaults to a caller-supplied draft.
 *
 * The caller's values must win, so the defaults are spread *first*. Spreading
 * them last (the previous order) silently discarded everything a caller
 * actually passed: marks, est_time_sec, status, source, tags, options and the
 * answer/rubric were all overwritten by their defaults.
 */
export function withEngineDefaults(input: CreateEngineQuestionInput): EngineQuestionDefaults {
  // The cast is needed because `input` is the *unparsed* schema input, whose
  // `options[].body` / `isCorrect` are still optional, while the return type is
  // the fully-defaulted shape. Every caller either passes a value already run
  // through createEngineQuestionSchema, or is validated immediately after by
  // validateOptionsForType, so the shape holds at runtime. Without the cast the
  // spread re-widens the type back to the input side.
  return {
    ...DEFAULTED,
    ...input,
    chapterId: input.chapterId ?? "",
    subjectId: input.subjectId ?? "",
  } as EngineQuestionDefaults;
}

export const updateEngineQuestionSchema = createEngineQuestionSchema.partial();

export type UpdateEngineQuestionInput = z.input<typeof updateEngineQuestionSchema>;

export const engineStatusTransitionSchema = z.object({
  status: z.enum(ENGINE_STATUSES),
  reviewNotes: z.string().max(4000).optional().default(""),
});

export type EngineStatusTransitionInput = z.infer<typeof engineStatusTransitionSchema>;

export const engineQuestionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional().default(""),
  type: z.string().trim().max(40).optional().default(""),
  status: z.string().trim().max(40).optional().default(""),
  topicId: z.string().trim().max(40).optional().default(""),
  difficulty: z.coerce.number().int().min(0).max(3).optional().default(0),
  board: z.string().trim().max(20).optional().default(""),
});

export type EngineQuestionQuery = z.infer<typeof engineQuestionQuerySchema>;

/**
 * Derives the canonical `question_answers.answer_json` payload from the
 * question body plus its normalised option list.
 *
 * The shape is intentionally per-type so the Phase-5 evaluator can dispatch on
 * it without re-deriving anything from the UI payload:
 *  - choice types  -> `correct_option` (single) or `correct_options` (multi)
 *  - assertion     -> `correct_option` + the assertion/reason text
 *  - match         -> `match_pairs`
 *  - fill_blank    -> `blanks` (with `accepted` aliases preserved)
 *  - equation      -> `balanced_equation` + split `reactants`/`products`
 *  - short / long  -> `value` (model answer) for AI/human grading
 *
 * Anything the caller supplied explicitly in `input.answer` always wins, so a
 * human can override the derived key (e.g. supply a hand-written `accepted`
 * list) without the derivation logic overwriting it.
 */
export function buildAnswerJson(
  input: {
    type: EngineType;
    assertion?: { assertion?: string; reason?: string };
    matchPairs?: Array<{ left: string; right: string }>;
    blanks?: Array<{ blank_index: number; answers: string[]; case_sensitive?: boolean }>;
    answer?: Record<string, unknown>;
    rubric?: { model_answer?: string };
  },
  options: NormalizedEngineOption[]
): Record<string, unknown> {
  const correct = options.filter((o) => o.is_correct);
  const derived: Record<string, unknown> = {};

  switch (input.type) {
    case "mcq":
    case "statement":
    case "case_based": {
      if (correct.length === 1) derived.correct_option = correct[0].label;
      else if (correct.length > 1) derived.correct_options = correct.map((o) => o.label);
      break;
    }
    case "assertion_reason": {
      if (correct.length === 1) derived.correct_option = correct[0].label;
      else if (correct.length > 1) derived.correct_options = correct.map((o) => o.label);
      if (input.assertion?.assertion) derived.assertion = input.assertion.assertion;
      if (input.assertion?.reason) derived.reason = input.assertion.reason;
      break;
    }
    case "match": {
      if (input.matchPairs?.length) derived.match_pairs = input.matchPairs;
      break;
    }
    case "fill_blank": {
      if (input.blanks?.length) {
        derived.blanks = input.blanks;
        derived.accepted = input.blanks.flatMap((b) => b.answers);
      }
      break;
    }
    case "equation": {
      const equation = (input.answer?.balanced_equation as string | undefined) ?? correct[0]?.body ?? "";
      if (equation) {
        derived.balanced_equation = equation;
        const [left, right] = equation.split(/\s*(?:->|-->|→|⇌|=>)\s*/);
        if (left) derived.reactants = left.split("+").map((s) => s.trim()).filter(Boolean);
        if (right) derived.products = right.split("+").map((s) => s.trim()).filter(Boolean);
      }
      break;
    }
    case "short":
    case "long": {
      const model =
        (input.answer?.value as string | undefined) ?? input.rubric?.model_answer ?? correct[0]?.body ?? "";
      if (model) derived.value = model;
      break;
    }
  }

  return { ...derived, ...(input.answer ?? {}) };
}

const csvCell = z.string().trim();

/**
 * A missing or blank CSV cell means "use the fallback" rather than "invalid
 * value": `z.string().trim()` turns "" into an empty string, which an enum
 * rejects, so both `undefined` and whitespace-only cells are rewritten to the
 * fallback before the enum ever sees them.
 */
const csvEnum = <T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v : fallback),
    z.enum(values)
  );

export const bulkEngineQuestionRowSchema = z.object({
  type: csvEnum(ENGINE_TYPES, "mcq"),
  stem: z.string().trim().min(1).max(12000),
  topic_slug: z.string().trim().min(1).max(200),
  subtopic_slug: z.string().trim().max(200).optional().default(""),
  difficulty: z.coerce.number().int().min(1).max(3),
  skill: csvEnum(ENGINE_SKILLS, "recall"),
  marks: z.coerce.number().min(0).max(100).default(1),
  neg_marks: z.coerce.number().min(0).max(100).default(0),
  est_time_sec: z.coerce.number().int().min(5).max(3600).default(60),
  board_pattern: csvEnum(ENGINE_BOARDS, "CBSE"),
  status: csvEnum(ENGINE_STATUSES, "draft"),
  source: csvEnum(ENGINE_SOURCES, "import"),
  tags: z.string().trim().max(2000).optional().default(""),
  options: z.string().trim().max(20000).optional().default(""),
  answer_json: z.string().trim().max(20000).optional().default(""),
  rubric_json: z.string().trim().max(20000).optional().default(""),
  explanation: z.string().trim().max(12000).optional().default(""),
});

export type BulkEngineQuestionRow = z.infer<typeof bulkEngineQuestionRowSchema>;

/**
 * Minimal RFC-4180 CSV parser (no external dependency): handles quoted cells,
 * embedded commas/newlines and doubled quotes. First row is the header.
 */
export function parseCsvRows(csv: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const text = csv.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (ch === "\r") { /* skip CR */ }
    else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).filter((r) => r.some((c) => c.trim() !== "")).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => { if (h) obj[h] = (r[idx] ?? "").trim(); });
    return obj;
  });
}

/**
 * Per-type structural validation of the option list.
 * Returns an error message, or null when valid.
 */
export function validateOptionsForType(type: CreateEngineQuestionInput["type"], options: EngineOptionInput[]): string | null {
  const bodies = options.map((o) => (o.body?.trim() ? o.body : (o.text ?? "").trim()));
  if (type === "mcq" || type === "assertion_reason" || type === "statement") {
    if (options.length < 2) return "At least two options are required.";
    if (options.length > 6) return "No more than six options are allowed.";
    if (bodies.some((b) => !b)) return "Every option needs text.";
    const correct = options.filter((o) => (o.is_correct ?? o.isCorrect ?? false)).length;
    if (correct !== 1) return "Exactly one option must be marked correct.";
    return null;
  }
  if (type === "match") {
    if (options.length < 2) return "Match pairs need at least two rows.";
    if (bodies.some((b) => !b)) return "Every match row needs text.";
    return null;
  }
  if (type === "fill_blank") {
    if (options.length < 1) return "At least one blank answer is required.";
    if (bodies.some((b) => !b)) return "Every blank needs at least one accepted answer.";
    return null;
  }
  return null;
}
