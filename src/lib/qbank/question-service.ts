import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api-utils";
import { QuestionTypeSchema, type CreateQuestionInput, type QuestionListQuery } from "./validation";

type Admin = SupabaseClient;

const QUESTION_LIST_SELECT = `
  id, question_text, explanation, marks, negative_marks, time_seconds, tags,
  status, engine_status, source, is_active, is_verified, created_at, updated_at,
  created_by, reviewed_by, reviewed_at, import_batch_id, board_pattern, lang,
  difficulty, skill, est_time_sec, neg_marks, topic_id, chapter_id, subject_id,
  question_type_id, difficulty_level_id,
  topics (id, code, name, slug),
  chapters (id, code, name, slug),
  question_types (code, name),
  difficulty_levels (code, name),
  subjects!inner (id, code, name, classes!inner (id, code, name, boards!inner (id, code, name, slug)))
`;

const QUESTION_FULL_SELECT = `
  *,
  question_options (id, label, body, option_text, image_url, is_correct, sort_order, position, created_at),
  question_answers (answer_json, rubric_json, explanation, created_at, updated_at)
`;

type EngineStatus = "draft" | "reviewed" | "published" | "retired";

export async function listQuestions(
  admin: Admin,
  query: QuestionListQuery
): Promise<{ rows: Record<string, unknown>[]; total: number; page: number; limit: number; totalPages: number; hasMore: boolean }> {
  const page = Math.max(query.page, 1);
  const limit = Math.min(Math.max(query.limit, 1), 100);
  const offset = (page - 1) * limit;
  let request = admin
    .from("questions")
    .select(QUESTION_LIST_SELECT, { count: "exact" })
    .order(query.sort_by, { ascending: query.sort_dir === "asc" });

  if (query.board_id) request = request.eq("subjects.classes.boards.id", query.board_id);
  if (query.class_id) request = request.eq("subjects.classes.id", query.class_id);
  if (query.subject_id) request = request.eq("subjects.id", query.subject_id);
  if (query.chapter_id) request = request.eq("chapter_id", query.chapter_id);
  if (query.topic_id) request = request.eq("topic_id", query.topic_id);
  if (query.subtopic_id) request = request.eq("subtopic_id", query.subtopic_id);
  if (query.question_type) request = request.eq("question_types.code", query.question_type);
  if (query.difficulty) request = request.eq("difficulty_level_id", await resolveDifficultyLevelId(admin, query.difficulty));
  if (query.language) request = request.eq("lang", query.language);
  if (query.status) request = request.eq("status", query.status);
  if (query.engine_status) request = request.eq("engine_status", query.engine_status);
  if (query.import_batch_id) request = request.eq("import_batch_id", query.import_batch_id);
  if (query.created_from) request = request.gte("created_at", `${query.created_from}T00:00:00.000Z`);
  if (query.created_to) {
    const exclusiveEnd = new Date(`${query.created_to}T00:00:00.000Z`);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    request = request.lt("created_at", exclusiveEnd.toISOString());
  }
  if (query.search) {
    const term = query.search.trim().replace(/[%_,()]/g, " ");
    if (term) request = request.ilike("question_text", `%${term}%`);
  }

  const { data, error, count } = await request.range(offset, offset + limit - 1);
  if (error) throw new ApiError(500, error.message, "DB_ERROR");
  const total = count ?? 0;
  return {
    rows: (data ?? []) as Record<string, unknown>[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasMore: offset + limit < total,
  };
}

export async function getQuestion(admin: Admin, id: string): Promise<Record<string, unknown>> {
  const { data, error } = await admin.from("questions").select(QUESTION_FULL_SELECT).eq("id", id).maybeSingle();
  if (error) throw new ApiError(500, error.message, "DB_ERROR");
  if (!data) throw new ApiError(404, "Question not found", "NOT_FOUND");
  return data as Record<string, unknown>;
}

export async function createQuestion(admin: Admin, userId: string, input: CreateQuestionInput) {
  await validateTaxonomy(admin, input);
  validateOptions(input.question_type, input.options);
  const [questionTypeId, difficultyId, languageId] = await Promise.all([
    resolveQuestionTypeId(admin, input.question_type),
    resolveDifficultyLevelId(admin, input.difficulty),
    resolveLanguageId(admin, input.language),
  ]);
  const status = input.status;
  const { data: question, error } = await admin
    .from("questions")
    .insert({
      question_type_id: questionTypeId,
      difficulty_level_id: difficultyId,
      language_id: languageId,
      topic_id: input.topic_id,
      subtopic_id: input.subtopic_id ?? null,
      chapter_id: input.chapter_id,
      subject_id: input.subject_id,
      question_text: input.question_text,
      explanation: input.explanation,
      marks: input.marks,
      negative_marks: input.negative_marks,
      time_seconds: input.time_seconds,
      tags: input.tags,
      metadata: { source: input.source, question_type: input.question_type },
      is_active: status !== "archived" && status !== "rejected",
      is_verified: status === "approved" || status === "published",
      created_by: userId,
      verified_by: status === "approved" || status === "published" ? userId : null,
      status,
      engine_status: mapLegacyStatusToEngine(status),
      engine_type: mapQuestionTypeToEngine(input.question_type),
      stem: input.question_text,
      difficulty: mapDifficultyToNumber(input.difficulty),
      skill: "recall",
      neg_marks: input.negative_marks,
      est_time_sec: input.time_seconds,
      board_pattern: "OTHER",
      lang: input.language,
      source: input.source,
    })
    .select("id")
    .single();
  if (error) throw new ApiError(500, error.message, "DB_ERROR");

  try {
    const options = input.options.map((option, index) => ({
      question_id: question.id,
      option_text: option.body,
      is_correct: option.is_correct,
      sort_order: option.position ?? index + 1,
      label: option.label,
      body: option.body,
      position: option.position ?? index + 1,
    }));
    const { error: optionsError } = await admin.from("question_options").insert(options);
    if (optionsError) throw optionsError;

    const { error: answerError } = await admin.from("question_answers").insert({
      question_id: question.id,
      answer_json: input.answer_json,
      rubric_json: input.rubric_json,
      explanation: input.explanation || null,
    });
    if (answerError) throw answerError;

    const { error: versionError } = await admin.from("question_versions").insert({
      question_id: question.id,
      version_number: 1,
      snapshot: input,
      changed_by: userId,
      change_reason: "Initial creation",
    });
    if (versionError) throw versionError;
  } catch (error) {
    const { error: cleanupError } = await admin.from("questions").delete().eq("id", question.id);
    if (cleanupError) console.error("Failed to clean up incomplete question creation", cleanupError);
    throw new ApiError(500, error instanceof Error ? error.message : "Question creation failed", "DB_ERROR");
  }

  return getQuestion(admin, question.id);
}

export async function updateQuestion(
  admin: Admin,
  id: string,
  userId: string,
  input: Partial<CreateQuestionInput> & { change_reason?: string }
) {
  const existing = await getQuestion(admin, id);
  const questionType = input.question_type ?? await resolveQuestionTypeCode(admin, existing.question_type_id);
  if (input.options) validateOptions(questionType, input.options);
  if (input.board_id || input.class_id || input.subject_id || input.chapter_id || input.topic_id) {
    await validateTaxonomy(admin, {
      board_id: input.board_id ?? "",
      class_id: input.class_id ?? "",
      subject_id: input.subject_id ?? "",
      chapter_id: input.chapter_id ?? "",
      topic_id: input.topic_id ?? "",
      subtopic_id: input.subtopic_id,
    });
  }

  const { data: versions, error: versionQueryError } = await admin
    .from("question_versions")
    .select("version_number")
    .eq("question_id", id)
    .order("version_number", { ascending: false })
    .limit(1);
  if (versionQueryError) throw new ApiError(500, versionQueryError.message, "DB_ERROR");
  const nextVersion = (versions?.[0]?.version_number ?? 0) + 1;
  const { error: versionError } = await admin.from("question_versions").insert({
    question_id: id,
    version_number: nextVersion,
    snapshot: existing,
    changed_by: userId,
    change_reason: input.change_reason || "Updated via admin editor",
  });
  if (versionError) throw new ApiError(500, versionError.message, "DB_ERROR");

  const update: Record<string, unknown> = {};
  if (input.question_text !== undefined) {
    update.question_text = input.question_text;
    update.stem = input.question_text;
  }
  if (input.explanation !== undefined) update.explanation = input.explanation;
  if (input.marks !== undefined) update.marks = input.marks;
  if (input.negative_marks !== undefined) {
    update.negative_marks = input.negative_marks;
    update.neg_marks = input.negative_marks;
  }
  if (input.time_seconds !== undefined) {
    update.time_seconds = input.time_seconds;
    update.est_time_sec = input.time_seconds;
  }
  if (input.tags !== undefined) update.tags = input.tags;
  if (input.status !== undefined) {
    update.status = input.status;
    update.engine_status = mapLegacyStatusToEngine(input.status);
    update.is_verified = input.status === "approved" || input.status === "published";
    update.is_active = input.status !== "archived" && input.status !== "rejected";
    update.reviewed_by = userId;
    update.reviewed_at = new Date().toISOString();
    if (input.status === "approved" || input.status === "published") update.verified_by = userId;
  }
  if (input.question_type !== undefined) {
    update.question_type_id = await resolveQuestionTypeId(admin, input.question_type);
    update.engine_type = mapQuestionTypeToEngine(input.question_type);
  }
  if (input.difficulty !== undefined) {
    update.difficulty_level_id = await resolveDifficultyLevelId(admin, input.difficulty);
    update.difficulty = mapDifficultyToNumber(input.difficulty);
  }
  if (input.language !== undefined) {
    update.lang = input.language;
    update.language_id = await resolveLanguageId(admin, input.language);
  }
  if (input.topic_id !== undefined) update.topic_id = input.topic_id;
  if (input.subtopic_id !== undefined) update.subtopic_id = input.subtopic_id;
  if (input.chapter_id !== undefined) update.chapter_id = input.chapter_id;
  if (input.subject_id !== undefined) update.subject_id = input.subject_id;

  if (Object.keys(update).length) {
    const { error } = await admin.from("questions").update(update).eq("id", id);
    if (error) throw new ApiError(500, error.message, "DB_ERROR");
  }

  if (input.options !== undefined) {
    const { error: deleteError } = await admin.from("question_options").delete().eq("question_id", id);
    if (deleteError) throw new ApiError(500, deleteError.message, "DB_ERROR");
    if (input.options.length) {
      const options = input.options.map((option, index) => ({
        question_id: id,
        option_text: option.body,
        is_correct: option.is_correct,
        sort_order: option.position ?? index + 1,
        label: option.label,
        body: option.body,
        position: option.position ?? index + 1,
      }));
      const { error } = await admin.from("question_options").insert(options);
      if (error) throw new ApiError(500, error.message, "DB_ERROR");
    }
  }

  if (input.options !== undefined || input.answer_json !== undefined || input.rubric_json !== undefined || input.explanation !== undefined) {
    const existingAnswer = readQuestionAnswer(existing.question_answers);
    const answerJson = { ...existingAnswer.answer_json };
    if (input.options !== undefined) {
      delete answerJson.correct_option;
      delete answerJson.correct_options;
      const correctLabels = input.options.filter((option) => option.is_correct).map((option) => option.label);
      if (correctLabels.length === 1) answerJson.correct_option = correctLabels[0];
      if (correctLabels.length > 1) answerJson.correct_options = correctLabels;
    }
    Object.assign(answerJson, input.answer_json ?? {});
    const { error } = await admin.from("question_answers").upsert(
      {
        question_id: id,
        answer_json: answerJson,
        rubric_json: { ...existingAnswer.rubric_json, ...(input.rubric_json ?? {}) },
        explanation: input.explanation ?? existingAnswer.explanation ?? null,
      },
      { onConflict: "question_id" }
    );
    if (error) throw new ApiError(500, error.message, "DB_ERROR");
  }

  return getQuestion(admin, id);
}

function readQuestionAnswer(value: unknown): {
  answer_json: Record<string, unknown>;
  rubric_json: Record<string, unknown>;
  explanation: string | null;
} {
  const record = Array.isArray(value) ? value[0] : value;
  if (!record || typeof record !== "object") {
    return { answer_json: {}, rubric_json: {}, explanation: null };
  }
  const row = record as Record<string, unknown>;
  return {
    answer_json: row.answer_json && typeof row.answer_json === "object" && !Array.isArray(row.answer_json)
      ? row.answer_json as Record<string, unknown>
      : {},
    rubric_json: row.rubric_json && typeof row.rubric_json === "object" && !Array.isArray(row.rubric_json)
      ? row.rubric_json as Record<string, unknown>
      : {},
    explanation: typeof row.explanation === "string" ? row.explanation : null,
  };
}

export async function archiveOrDeleteQuestion(admin: Admin, id: string) {
  const [{ data: legacyRefs, error: legacyError }, { data: engineRefs, error: engineError }, { data: versions, error: versionError }] = await Promise.all([
    admin.from("mock_test_questions").select("id").eq("question_id", id).limit(1),
    admin.from("test_instance_questions").select("id").eq("question_id", id).limit(1),
    admin.from("question_versions").select("id").eq("question_id", id).limit(1),
  ]);
  if (legacyError) throw new ApiError(500, legacyError.message, "DB_ERROR");
  if (engineError) throw new ApiError(500, engineError.message, "DB_ERROR");
  if (versionError) throw new ApiError(500, versionError.message, "DB_ERROR");
  if ((legacyRefs?.length ?? 0) > 0 || (engineRefs?.length ?? 0) > 0 || (versions?.length ?? 0) > 0) {
    const { error } = await admin.from("questions").update({
      engine_status: "retired",
      status: "archived",
      is_active: false,
    }).eq("id", id);
    if (error) throw new ApiError(500, error.message, "DB_ERROR");
    return { id, mode: "retired" as const };
  }
  const { error } = await admin.from("questions").delete().eq("id", id);
  if (error) throw new ApiError(500, error.message, "DB_ERROR");
  return { id, mode: "deleted" as const };
}

export async function transitionReviewStatus(
  admin: Admin,
  id: string,
  toStatus: "draft" | "review" | "approved" | "published" | "rejected" | "archived",
  reviewerId: string,
  reviewNotes: string
) {
  await getQuestion(admin, id);
  const toEngine = mapLegacyStatusToEngine(toStatus);
  const { error } = await admin.from("questions").update({
    status: toStatus,
    engine_status: toEngine,
    is_verified: toStatus === "approved" || toStatus === "published",
    is_active: toStatus !== "archived" && toStatus !== "rejected",
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
    review_notes: reviewNotes.trim() || null,
  }).eq("id", id);
  if (error) throw new ApiError(500, error.message, "DB_ERROR");

  return getQuestion(admin, id);
}

async function validateTaxonomy(admin: Admin, input: Pick<CreateQuestionInput, "board_id" | "class_id" | "subject_id" | "chapter_id" | "topic_id" | "subtopic_id">) {
  const [{ data: subject, error: subjectError }, { data: chapter, error: chapterError }, { data: topic, error: topicError }, { data: subtopic, error: subtopicError }] = await Promise.all([
    admin.from("subjects").select("id, class_id").eq("id", input.subject_id).maybeSingle(),
    admin.from("chapters").select("id, subject_id").eq("id", input.chapter_id).maybeSingle(),
    admin.from("topics").select("id, chapter_id").eq("id", input.topic_id).maybeSingle(),
    input.subtopic_id ? admin.from("subtopics").select("id, topic_id").eq("id", input.subtopic_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  for (const error of [subjectError, chapterError, topicError, subtopicError]) {
    if (error) throw new ApiError(500, error.message, "DB_ERROR");
  }
  if (!subject || !chapter || !topic || subject.class_id !== input.class_id || chapter.subject_id !== input.subject_id || topic.chapter_id !== input.chapter_id) {
    throw new ApiError(400, "The selected board, class, subject, chapter, and topic do not match.", "INVALID_TAXONOMY");
  }
  const { data: klass, error: classError } = await admin.from("classes").select("id, board_id").eq("id", input.class_id).maybeSingle();
  if (classError) throw new ApiError(500, classError.message, "DB_ERROR");
  if (!klass || klass.board_id !== input.board_id) throw new ApiError(400, "The selected class does not belong to this board.", "INVALID_TAXONOMY");
  if (input.subtopic_id && (!subtopic || subtopic.topic_id !== input.topic_id)) {
    throw new ApiError(400, "The selected subtopic does not belong to this topic.", "INVALID_TAXONOMY");
  }
}

function validateOptions(type: CreateQuestionInput["question_type"], options: CreateQuestionInput["options"]) {
  const correctCount = options.filter((option) => option.is_correct).length;
  if (type === "multiple_correct") {
    if (options.length < 2 || correctCount < 1) throw new ApiError(400, "Multiple-correct questions need at least two options and one correct answer.", "INVALID_OPTIONS");
    return;
  }
  if (type === "single_correct" || type === "true_false") {
    const expectedOptions = type === "true_false" ? 2 : 2;
    if (options.length < expectedOptions || correctCount !== 1) {
      throw new ApiError(400, "This question type needs at least two options and exactly one correct answer.", "INVALID_OPTIONS");
    }
  }
}

async function resolveQuestionTypeId(admin: Admin, code: string): Promise<string> {
  const { data, error } = await admin.from("question_types").select("id").eq("code", code).maybeSingle();
  if (error) throw new ApiError(500, error.message, "DB_ERROR");
  if (!data) throw new ApiError(400, `Question type '${code}' is not configured.`, "VOCAB_MISSING");
  return data.id;
}

async function resolveQuestionTypeCode(admin: Admin, id: unknown): Promise<CreateQuestionInput["question_type"]> {
  if (typeof id !== "string") throw new ApiError(400, "Question type is missing.", "VOCAB_MISSING");
  const { data, error } = await admin.from("question_types").select("code").eq("id", id).maybeSingle();
  if (error) throw new ApiError(500, error.message, "DB_ERROR");
  const result = QuestionTypeSchema.safeParse(data?.code);
  if (!result.success) throw new ApiError(400, "Question type is not supported.", "VOCAB_MISSING");
  return result.data;
}

async function resolveDifficultyLevelId(admin: Admin, code: string): Promise<string> {
  const { data, error } = await admin.from("difficulty_levels").select("id").eq("code", code).maybeSingle();
  if (error) throw new ApiError(500, error.message, "DB_ERROR");
  if (!data) throw new ApiError(400, `Difficulty '${code}' is not configured.`, "VOCAB_MISSING");
  return data.id;
}

async function resolveLanguageId(admin: Admin, code: string): Promise<string | null> {
  const { data, error } = await admin.from("languages").select("id").eq("code", code).maybeSingle();
  if (error) throw new ApiError(500, error.message, "DB_ERROR");
  if (!data) throw new ApiError(400, `Language '${code}' is not configured.`, "VOCAB_MISSING");
  return data.id;
}

function mapLegacyStatusToEngine(status: string): EngineStatus {
  if (status === "review") return "reviewed";
  if (status === "approved" || status === "published") return "published";
  if (status === "rejected" || status === "archived") return "retired";
  return "draft";
}

function mapQuestionTypeToEngine(type: string): string {
  const map: Record<string, string> = {
    single_correct: "mcq",
    multiple_correct: "mcq",
    true_false: "statement",
    fill_blank: "fill_blank",
    match_following: "match",
    assertion_reason: "assertion_reason",
    numerical: "equation",
    short_answer: "short",
    long_answer: "long",
  };
  return map[type] ?? "mcq";
}

function mapDifficultyToNumber(difficulty: string): 1 | 2 | 3 {
  const map: Record<string, 1 | 2 | 3> = { easy: 1, medium: 2, hard: 3 };
  return map[difficulty] ?? 2;
}
