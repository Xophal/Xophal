export type QuestionType =
  | "mcq"
  | "assertion_reason"
  | "match"
  | "statement"
  | "case_based"
  | "fill_blank"
  | "equation"
  | "short"
  | "long";

export type QuestionSkill = "recall" | "application" | "reasoning";

export type BoardPattern = "CBSE" | "SEBA" | "OTHER";

export type QuestionStatus = "draft" | "reviewed" | "published" | "retired";

export type QuestionSource = "manual" | "ai" | "import";

export type BlueprintKind =
  | "topic"
  | "full_chapter"
  | "board_pattern"
  | "adaptive"
  | "weak_area"
  | "daily"
  | "diagnostic"
  | "speed"
  | "custom";

export type AttemptStatus = "in_progress" | "submitted" | "expired" | "graded";

export type GraderType = "auto" | "ai" | "human";

// ----------------------------------------------------------------------------
// TAXONOMY
// ----------------------------------------------------------------------------
export interface Exam {
  id: string;
  code: string;
  name: string;
  slug: string;
  description?: string | null;
  sort_order: number;
  is_active: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  class_id: string;
  code: string;
  name: string;
  slug: string;
  color?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: string;
  subject_id: string;
  code: string;
  name: string;
  slug: string;
  chapter_number?: number | null;
  description?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Topic {
  id: string;
  chapter_id: string;
  code: string;
  name: string;
  slug: string;
  description?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subtopic {
  id: string;
  topic_id: string;
  code: string;
  name: string;
  slug: string;
  description?: string | null;
  sort_order: number;
  is_active: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// QUESTION BANK
// ----------------------------------------------------------------------------
export interface QuestionOption {
  id?: string;
  question_id?: string;
  label: string;
  body: string;
  is_correct: boolean;
  position: number;
}

export interface QuestionAnswer {
  id?: string;
  question_id: string;
  answer_json: Record<string, unknown>;
  rubric_json: Record<string, unknown>;
  explanation?: string | null;
}

export interface Question {
  id: string;
  type: QuestionType;
  stem: string;
  parent_id?: string | null;
  topic_id?: string | null;
  subtopic_id?: string | null;
  difficulty: 1 | 2 | 3;
  skill: QuestionSkill;
  marks: number;
  neg_marks: number;
  est_time_sec: number;
  board_pattern: BoardPattern;
  pyq_year?: number | null;
  lang: string;
  status: QuestionStatus;
  source: QuestionSource;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  options?: QuestionOption[];
  answers?: QuestionAnswer;
  tags?: string[];
}

export interface QuestionStats {
  question_id: string;
  attempts: number;
  correct_count: number;
  correct_rate: number;
  avg_time: number;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// BLUEPRINTS
// ----------------------------------------------------------------------------
export interface BlueprintSectionFilter {
  topic_ids?: string[];
  subtopic_ids?: string[];
  types?: QuestionType[];
  difficulty_min?: number;
  difficulty_max?: number;
  skills?: QuestionSkill[];
  tags?: string[];
  pyq_only?: boolean;
}

export interface BlueprintSection {
  id?: string;
  blueprint_id?: string;
  title: string;
  position: number;
  filter_json: BlueprintSectionFilter;
  count: number;
  marks_per_q: number;
  neg_marks: number;
  instructions?: string | null;
}

export interface Blueprint {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  kind: BlueprintKind;
  duration_sec: number;
  total_marks: number;
  marking_scheme_json: Record<string, unknown>;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  is_public: boolean;
  chapter_id?: string | null;
  subject_id?: string | null;
  created_by?: string | null;
  sections?: BlueprintSection[];
  created_at?: string;
  updated_at?: string;
}

// ----------------------------------------------------------------------------
// TEST INSTANCES & ATTEMPTS
// ----------------------------------------------------------------------------
export interface TestInstanceQuestion {
  id?: string;
  instance_id: string;
  question_id: string;
  section_id?: string | null;
  position: number;
  marks: number;
  neg_marks: number;
  question?: Omit<Question, "answers"> & {
    options?: Omit<QuestionOption, "is_correct">[];
  };
}

export interface TestInstance {
  id: string;
  blueprint_id: string;
  user_id?: string | null;
  generated_at: string;
  seed: string;
  metadata?: Record<string, unknown>;
  questions?: TestInstanceQuestion[];
  blueprint?: Blueprint;
}

export interface AttemptAnswer {
  id?: string;
  attempt_id: string;
  question_id: string;
  response_json: Record<string, unknown>;
  is_correct?: boolean | null;
  marks_awarded?: number | null;
  time_spent_sec: number;
  flagged: boolean;
  visit_count: number;
  graded_by?: GraderType;
  feedback?: string | null;
}

export interface Attempt {
  id: string;
  instance_id: string;
  user_id: string;
  status: AttemptStatus;
  started_at: string;
  deadline_at: string;
  submitted_at?: string | null;
  score?: number | null;
  max_score: number;
  time_spent_sec: number;
  metadata?: Record<string, unknown>;
  answers?: AttemptAnswer[];
}

// ----------------------------------------------------------------------------
// ANALYTICS & MASTERY
// ----------------------------------------------------------------------------
export interface TopicMastery {
  id?: string;
  user_id: string;
  topic_id: string;
  attempted: number;
  correct: number;
  mastery_score: number;
  last_seen_at: string;
}

export interface Streak {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string;
  updated_at: string;
}

