import { z } from "zod";

export const QuestionStatusSchema = z.enum([
  "draft", "review", "approved", "published", "rejected", "archived",
]);

export const QuestionTypeSchema = z.enum([
  "single_correct", "multiple_correct", "true_false", "fill_blank",
  "match_following", "assertion_reason", "numerical", "short_answer", "long_answer",
]);

export const DifficultySchema = z.enum(["easy", "medium", "hard"]);

export const ImportStatusSchema = z.enum([
  "pending", "validating", "validated", "importing", "completed", "failed", "cancelled",
]);

export const DuplicatePolicySchema = z.enum([
  "skip", "import_as_new", "update_after_review",
]);

export const ImportDefaultStatusSchema = z.enum(["draft", "pending_review", "approved"]);

export const CreateQuestionSchema = z.object({
  board_id: z.string().uuid("Invalid board"),
  class_id: z.string().uuid("Invalid class"),
  subject_id: z.string().uuid("Invalid subject"),
  chapter_id: z.string().uuid("Invalid chapter"),
  topic_id: z.string().uuid("Invalid topic"),
  subtopic_id: z.string().uuid().nullable().optional(),
  question_type: QuestionTypeSchema,
  question_text: z.string().trim().min(1, "Question text is required").max(12000),
  explanation: z.string().max(12000).optional().default(""),
  language: z.string().min(1).max(10).default("en"),
  difficulty: DifficultySchema,
  marks: z.number().min(0).max(100).default(1),
  negative_marks: z.number().min(0).max(100).default(0),
  time_seconds: z.number().int().min(5).max(3600).default(60),
  status: QuestionStatusSchema.default("draft"),
  source: z.enum(["manual", "import"]).default("manual"),
  options: z.array(z.object({
    label: z.string().trim().min(1).max(10),
    body: z.string().trim().min(1).max(5000),
    is_correct: z.boolean().default(false),
    position: z.number().int().min(0).max(50).optional(),
  })).min(1, "At least one option is required"),
  answer_json: z.record(z.string(), z.unknown()).default({}),
  rubric_json: z.record(z.string(), z.unknown()).default({}),
  tags: z.array(z.string().trim().max(100)).max(30).default([]),
});

export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;

export const QuestionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  board_id: z.string().uuid().optional(),
  class_id: z.string().uuid().optional(),
  subject_id: z.string().uuid().optional(),
  chapter_id: z.string().uuid().optional(),
  topic_id: z.string().uuid().optional(),
  subtopic_id: z.string().uuid().optional(),
  question_type: QuestionTypeSchema.optional(),
  difficulty: DifficultySchema.optional(),
  language: z.string().max(10).optional(),
  status: QuestionStatusSchema.optional(),
  engine_status: z.enum(["draft", "reviewed", "published", "retired"]).optional(),
  import_batch_id: z.string().uuid().optional(),
  created_from: z.iso.date().optional(),
  created_to: z.iso.date().optional(),
  sort_by: z.enum(["created_at", "updated_at", "question_text", "difficulty", "marks"]).default("created_at"),
  sort_dir: z.enum(["asc", "desc"]).default("desc"),
});

export type QuestionListQuery = z.infer<typeof QuestionListQuerySchema>;

export const ColumnMappingSchema = z.object({
  question: z.string().optional(),
  option_a: z.string().optional(),
  option_b: z.string().optional(),
  option_c: z.string().optional(),
  option_d: z.string().optional(),
  option_e: z.string().optional(),
  option_f: z.string().optional(),
  correct_answer: z.string().optional(),
  explanation: z.string().optional(),
  chapter: z.string().optional(),
  topic: z.string().optional(),
  difficulty: z.string().optional(),
  marks: z.string().optional(),
  negative_marks: z.string().optional(),
  language: z.string().optional(),
  question_type: z.string().optional(),
});

export type ColumnMapping = z.infer<typeof ColumnMappingSchema>;

export const StartImportSchema = z.object({
  board_id: z.string().uuid(),
  class_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  chapter_id: z.string().uuid().optional().nullable(),
  topic_id: z.string().uuid().optional().nullable(),
  column_mapping: ColumnMappingSchema,
  default_status: ImportDefaultStatusSchema.default("pending_review"),
  default_difficulty: DifficultySchema.default("medium"),
  default_language: z.string().min(1).max(10).default("en"),
  duplicate_policy: DuplicatePolicySchema.default("skip"),
  skip_invalid: z.boolean().default(true),
});

export type StartImportInput = z.infer<typeof StartImportSchema>;

export const ReviewQuestionSchema = z.object({
  question_id: z.string().uuid(),
  action: z.enum(["approve", "reject", "archive"]),
  review_notes: z.string().max(4000).optional().default(""),
});

export type ReviewQuestionInput = z.infer<typeof ReviewQuestionSchema>;

export const BulkReviewSchema = z.object({
  question_ids: z.array(z.string().uuid()).min(1),
  action: z.enum(["approve", "reject", "archive"]),
  review_notes: z.string().max(4000).optional().default(""),
});

export type BulkReviewInput = z.infer<typeof BulkReviewSchema>;