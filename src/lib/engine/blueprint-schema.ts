import { z } from "zod";
import { ENGINE_BOARDS, ENGINE_SKILLS, ENGINE_TYPES } from "./vocab";
import type { EngineBoard, EngineSkill, EngineType } from "./vocab";

/* ------------------------------------------------------------------ kinds */

export const BLUEPRINT_KINDS = [
  "topic",
  "full_chapter",
  "board_pattern",
  "adaptive",
  "weak_area",
  "daily",
  "diagnostic",
  "speed",
  "custom",
] as const;

export type BlueprintKind = (typeof BLUEPRINT_KINDS)[number];

/* ---------------------------------------------------------------- filter */

const uuidList = z.array(z.string().uuid()).max(200).default([]);
const slugList = z.array(z.string().trim().min(1).max(200)).max(200).default([]);
const typeList = z.array(z.enum(ENGINE_TYPES)).max(9).default([]);
const skillList = z.array(z.enum(ENGINE_SKILLS)).max(3).default([]);

/**
 * Per-section question filter. Every clause is optional and an empty clause is
 * treated as "no constraint", so a section always means "questions matching all
 * of the clauses that are set".
 *
 * `topic_ids` is authoritative; `topic_slugs` is kept in the JSON for human
 * readability and for generator tests that run without a database, and is
 * resolved to ids at generation time when `topic_ids` is empty.
 */
export const sectionFilterSchema = z
  .object({
    topic_ids: uuidList,
    subtopic_ids: uuidList,
    topic_slugs: slugList,
    subtopic_slugs: slugList,
    types: typeList,
    skills: skillList,
    difficulty_min: z.number().int().min(1).max(3).default(1),
    difficulty_max: z.number().int().min(1).max(3).default(3),
    board_patterns: z.array(z.enum(ENGINE_BOARDS)).max(3).default([]),
    tags: slugList,
    pyq_only: z.boolean().default(false),
    /**
     * Case-based *parents* (the passage rows) carry the shared stem and score
     * zero marks, so they must never be served as standalone questions. A parent
     * is a `case_based` row with no `parent_id`; a standalone question of any
     * other type is not a parent. Children are selected instead and the parent
     * passage is attached at serve time (Phase 4).
     */
    exclude_parents: z.boolean().default(true),
    exclude_children: z.boolean().default(false),
    lang: z.string().trim().min(2).max(10).default("en"),
  })
  .refine((f) => f.difficulty_min <= f.difficulty_max, {
    message: "difficulty_min must be <= difficulty_max",
    path: ["difficulty_min"],
  });

export type SectionFilter = z.infer<typeof sectionFilterSchema>;

/* ---------------------------------------------------- difficulty weights */

/**
 * Requested difficulty mix, e.g. `{ "1": 4, "2": 4, "3": 2 }` for a 10-question
 * section. The generator fills as close to this as the bank allows, then relaxes
 * (see RELAXATION_ORDER) if a band is short.
 */
export const difficultyMixSchema = z.record(z.enum(["1", "2", "3"]), z.number().int().min(0).max(200)).default({});

export type DifficultyMix = z.infer<typeof difficultyMixSchema>;

/* --------------------------------------------------------------- section */

export const blueprintSectionInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  position: z.number().int().min(0).max(200).default(0),
  filter: sectionFilterSchema.default({}),
  count: z.number().int().min(0).max(200).default(5),
  marks_per_q: z.number().min(0).max(100).default(1),
  neg_marks: z.number().min(0).max(100).default(0),
  instructions: z.string().max(2000).optional().default(""),
  difficulty_mix: difficultyMixSchema.default({}),
});

export type BlueprintSectionInput = z.input<typeof blueprintSectionInputSchema>;
export type BlueprintSectionDefaults = z.infer<typeof blueprintSectionInputSchema>;

/* ------------------------------------------------------------- blueprint */

export const markingSchemeSchema = z
  .object({
    default_marks: z.number().min(0).max(100).default(1),
    default_neg_marks: z.number().min(0).max(100).default(0),
  })
  .partial()
  .default({});

export type MarkingScheme = z.infer<typeof markingSchemeSchema>;

const DEFAULT_SECTION = blueprintSectionInputSchema
  .pick({ position: true, filter: true, count: true, marks_per_q: true, neg_marks: true, instructions: true, difficulty_mix: true })
  .parse({});

/**
 * Applies section-level schema defaults.
 *
 * The caller's own values must win, so the defaults are spread *first* and the
 * input *after*. The filter is merged separately: it is a nested object, so a
 * caller who sets one clause (e.g. only `topic_ids`) would otherwise lose every
 * other default, and one who omits it entirely would lose all of them.
 */
export function withSectionDefaults(input: BlueprintSectionInput): BlueprintSectionDefaults {
  const { filter, ...rest } = input;
  return {
    ...DEFAULT_SECTION,
    ...rest,
    filter: filter ? sectionFilterSchema.parse(filter) : DEFAULT_SECTION.filter,
    title: input.title,
  };
}

export const createBlueprintSchema = z.object({
  name: z.string().trim().min(1).max(300),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase kebab-case"),
  description: z.string().max(4000).optional().default(""),
  kind: z.enum(BLUEPRINT_KINDS).default("custom"),
  duration_sec: z.number().int().min(30).max(8 * 3600).default(1800),
  total_marks: z.number().min(0).max(1000).default(0),
  marking_scheme: markingSchemeSchema,
  shuffle_questions: z.boolean().default(true),
  shuffle_options: z.boolean().default(true),
  is_public: z.boolean().default(true),
  chapter_id: z.string().uuid().nullable().optional(),
  subject_id: z.string().uuid().nullable().optional(),
  sections: z.array(blueprintSectionInputSchema).min(1).max(30).default([]),
});

export type CreateBlueprintInput = z.input<typeof createBlueprintSchema>;

export const updateBlueprintSchema = createBlueprintSchema.partial();

export type UpdateBlueprintInput = z.input<typeof updateBlueprintSchema>;

export const blueprintQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional().default(""),
  kind: z.string().trim().max(40).optional().default(""),
  chapterId: z.string().uuid().optional().default(""),
  isPublic: z
    .union([z.literal("true"), z.literal("false"), z.literal("")])
    .optional()
    .default(""),
});

export type BlueprintQuery = z.infer<typeof blueprintQuerySchema>;
