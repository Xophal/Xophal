import { z } from "zod";

export const ENGINE_TYPES = [
  "mcq",
  "assertion_reason",
  "match",
  "statement",
  "case_based",
  "fill_blank",
  "equation",
  "short",
  "long",
] as const;

export type EngineType = (typeof ENGINE_TYPES)[number];

export const ENGINE_SKILLS = ["recall", "application", "reasoning"] as const;
export type EngineSkill = (typeof ENGINE_SKILLS)[number];

export const ENGINE_BOARDS = ["CBSE", "SEBA", "OTHER"] as const;
export type EngineBoard = (typeof ENGINE_BOARDS)[number];

/**
 * Engine lifecycle states. Phase 1 legacy dual-writes keep
 * `questions.status` in lock-step (see ENGINE_STATUS_TO_LEGACY).
 */
export const ENGINE_STATUSES = ["draft", "reviewed", "published", "retired"] as const;
export type EngineStatus = (typeof ENGINE_STATUSES)[number];

export const ENGINE_SOURCES = ["manual", "ai", "import"] as const;
export type EngineSource = (typeof ENGINE_SOURCES)[number];

/** Legacy `question_types.code` each engine type maps to (dual-write compat). */
export const LEGACY_QTYPE_FOR_ENGINE: Record<EngineType, string> = {
  mcq: "single_correct",
  assertion_reason: "assertion_reason",
  match: "match_following",
  statement: "true_false",
  case_based: "case_study",
  fill_blank: "fill_blank",
  equation: "equation_balancing",
  short: "descriptive",
  long: "descriptive",
};

/** Difficulty 1-3 -> legacy `difficulty_levels.code`. */
export const LEGACY_DIFF_FOR_LEVEL: Record<string, string> = {
  "1": "easy",
  "2": "medium",
  "3": "hard",
};

/** Engine status -> legacy `questions.status` (dual-write compat). */
export const ENGINE_STATUS_TO_LEGACY: Record<EngineStatus, string> = {
  draft: "draft",
  reviewed: "approved",
  published: "published",
  retired: "archived",
};

/** Review workflow. draft -> reviewed -> published; any non-retired state can retire. */
const TRANSITIONS: Record<EngineStatus, EngineStatus[]> = {
  draft: ["reviewed", "published", "retired"],
  reviewed: ["published", "draft", "retired"],
  published: ["retired", "reviewed", "draft"],
  retired: ["draft"],
};

export function isAllowedEngineTransition(from: EngineStatus, to: EngineStatus): boolean {
  if (from === to) return true;
  return (TRANSITIONS[from] ?? []).includes(to);
}

export const engineTypeSchema = z.enum(ENGINE_TYPES);
export const engineStatusSchema = z.enum(ENGINE_STATUSES);

