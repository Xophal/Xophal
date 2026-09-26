import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api-utils";
import { ENGINE_STATUS_TO_LEGACY, LEGACY_DIFF_FOR_LEVEL, LEGACY_QTYPE_FOR_ENGINE, isAllowedEngineTransition } from "./vocab";
import type { EngineStatus, EngineType } from "./vocab";
import type {
  BulkEngineQuestionRow,
  CreateEngineQuestionInput,
  EngineOptionInput,
  EngineQuestionDefaults,
  EngineQuestionQuery,
  NormalizedEngineOption,
  UpdateEngineQuestionInput,
} from "./question-schema";
import { buildAnswerJson, validateOptionsForType, withEngineDefaults } from "./question-schema";

type Admin = SupabaseClient;

const LIST_SELECT = "id,question_text,explanation,marks,negative_marks,time_seconds,tags,status,is_active,is_verified,created_at,updated_at,topic_id,chapter_id,subject_id,question_type_id,difficulty_level_id,engine_type,stem,parent_id,subtopic_id,difficulty,skill,neg_marks,est_time_sec,board_pattern,pyq_year,lang,engine_status,source,review_notes";

function norm(opts: EngineOptionInput[] | undefined): NormalizedEngineOption[] {
  return (opts ?? []).map((o, i) => ({
    label: (o.label ?? String.fromCharCode(65 + i)).trim() || String.fromCharCode(65 + i),
    body: (o.body?.trim() ? o.body : (o.text ?? "")).trim(),
    is_correct: Boolean(o.is_correct ?? o.isCorrect ?? false),
    position: o.position ?? o.sortOrder ?? i + 1,
  }));
}

/**
 * Rebuilds the option list from the persisted `question_options` rows so a
 * partial PATCH still validates and rewrites the whole option set atomically.
 * Legacy rows only carry `option_text`/`sort_order`, hence the fallbacks.
 */
function rawFallback(stored: unknown): EngineOptionInput[] {
  const rows = Array.isArray(stored) ? stored : [];
  return rows.map((o, i) => {
    const r = (o ?? {}) as Record<string, unknown>;
    return {
      label: String(r.label ?? String.fromCharCode(65 + i)),
      body: String(r.body ?? r.option_text ?? ""),
      is_correct: Boolean(r.is_correct),
      position: Number(r.position ?? r.sort_order ?? i + 1),
    };
  });
}

async function vocab(admin: Admin, type: EngineType, level: number) {
  const legacyQ = LEGACY_QTYPE_FOR_ENGINE[type] ?? "single_correct";
  const legacyD = LEGACY_DIFF_FOR_LEVEL[String(level)] ?? "medium";
  const { data: qt, error: qe } = await admin.from("question_types").select("id,code").ilike("code", legacyQ).maybeSingle();
  if (qe || !qt) throw new ApiError(500, `Question type '${legacyQ}' is not configured.`, "VOCAB_MISSING");
  const { data: dl, error: de } = await admin.from("difficulty_levels").select("id,code").ilike("code", legacyD).maybeSingle();
  if (de || !dl) throw new ApiError(500, `Difficulty '${legacyD}' is not configured.`, "VOCAB_MISSING");
  return { qt, dl };
}

async function topicChain(admin: Admin, topicId: string) {
  const { data: t, error } = await admin.from("topics").select("id,chapter_id,code").eq("id", topicId).maybeSingle();
  if (error || !t) throw new ApiError(400, "Unknown topicId.", "INVALID_TOPIC");
  const chapterId: string | null = t.chapter_id ?? null;
  let subjectId: string | null = null;
  if (chapterId) {
    const { data: ch } = await admin.from("chapters").select("id,subject_id").eq("id", chapterId).maybeSingle();
    if (ch) subjectId = (ch.subject_id as string | null) ?? null;
  }
  return { topic: t, chapterId, subjectId };
}

/**
 * A case-based *parent* is the passage row: it carries the shared stem, scores
 * zero marks and is never served as a standalone question. It is stored as a
 * `case_based` question because `engine_question_type` has no `case_passage`
 * value, so it is filtered out of the browse/review lists here - a reviewer
 * should not be asked to review a zero-mark passage. The row itself is left
 * untouched, and its children still resolve it via `parent_id` at serve time.
 */
const NOT_A_CASE_PARENT = "engine_type.neq.case_based,parent_id.not.is.null";

export async function listEngineQuestions(admin: Admin, q: EngineQuestionQuery) {
  let query = admin.from("questions").select(`${LIST_SELECT},question_options(id,label,body,option_text,is_correct,position,sort_order)`, { count: "exact" });
  query = query.or(NOT_A_CASE_PARENT);
  if (q.search) query = query.ilike("question_text", `%${q.search}%`);
  if (q.type) query = query.eq("engine_type", q.type);
  if (q.status) query = query.eq("engine_status", q.status);
  if (q.topicId) query = query.eq("topic_id", q.topicId);
  if (q.difficulty) query = query.eq("difficulty", q.difficulty);
  if (q.board) query = query.eq("board_pattern", q.board);
  const offset = (q.page - 1) * q.limit;
  const { data, error, count } = await query.order("updated_at", { ascending: false }).range(offset, offset + q.limit - 1);
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0, page: q.page, limit: q.limit };
}

export async function getEngineQuestion(admin: Admin, id: string) {
  const { data, error } = await admin
    .from("questions")
    .select(`${LIST_SELECT},question_options(*),question_answers(answer_json,rubric_json,explanation),question_tags(tag),question_stats(attempts,correct_count,correct_rate,avg_time)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "Question not found.", "NOT_FOUND");
  return data;
}

export async function createEngineQuestion(admin: Admin, userId: string | null, draft: CreateEngineQuestionInput) {
  const input = withEngineDefaults(draft);
  const optErr = validateOptionsForType(input.type, input.options);
  if (optErr) throw new ApiError(400, optErr, "INVALID_OPTIONS");
  const options = norm(input.options);
  const { qt, dl } = await vocab(admin, input.type, input.difficulty);
  const chain = await topicChain(admin, input.topicId);
  const subtopicId: string | null = input.subtopicId ?? null;
  if (subtopicId) {
    const { data: st } = await admin.from("subtopics").select("id,topic_id").eq("id", subtopicId).maybeSingle();
    if (!st || st.topic_id !== input.topicId) throw new ApiError(400, "subtopicId does not belong to topicId.", "INVALID_SUBTOPIC");
  }
  if (input.parentId) {
    const { data: p } = await admin.from("questions").select("id").eq("id", input.parentId).maybeSingle();
    if (!p) throw new ApiError(400, "parentId not found.", "INVALID_PARENT");
  }
  const answerJson = buildAnswerJson(input, options);
  const explanation = (input.explanation ?? "").trim() || null;
  const payload = {
    question_type_id: qt.id,
    difficulty_level_id: dl.id,
    topic_id: input.topicId,
    chapter_id: input.chapterId || chain.chapterId,
    subject_id: input.subjectId || chain.subjectId,
    question_text: input.stem.trim(),
    explanation,
    marks: input.marks,
    negative_marks: input.negMarks,
    time_seconds: input.estTimeSec,
    tags: input.tags ?? [],
    metadata: { engine: true, assertion: input.assertion ?? null, match_pairs: input.matchPairs ?? [], blanks: input.blanks ?? [] },
    is_active: true,
    is_verified: input.status === "published" || input.status === "reviewed",
    status: ENGINE_STATUS_TO_LEGACY[input.status],
    engine_type: input.type,
    stem: input.stem.trim(),
    parent_id: input.parentId ?? null,
    subtopic_id: subtopicId,
    difficulty: input.difficulty,
    skill: input.skill,
    neg_marks: input.negMarks,
    est_time_sec: input.estTimeSec,
    board_pattern: input.boardPattern,
    pyq_year: input.pyqYear ?? null,
    lang: input.lang,
    engine_status: input.status,
    source: input.source,
    created_by: userId,
  };
  const { data: q, error } = await admin.from("questions").insert([payload]).select("id").single();
  if (error) throw error;
  await admin.from("question_answers").upsert({ question_id: q.id, answer_json: answerJson, rubric_json: input.rubric ?? {}, explanation }, { onConflict: "question_id" });
  if (options.length) {
    const rows = options.map((o) => ({ question_id: q.id, option_text: o.body, label: o.label, body: o.body, is_correct: o.is_correct, sort_order: o.position, position: o.position }));
    const { error: oe } = await admin.from("question_options").insert(rows);
    if (oe) throw oe;
  }
  await syncSideTables(admin, q.id, input);
  return getEngineQuestion(admin, q.id);
}

export async function updateEngineQuestion(admin: Admin, id: string, input: UpdateEngineQuestionInput) {
  const cur = await getEngineQuestion(admin, id) as Record<string, unknown>;
  const type = (input.type ?? cur.engine_type ?? "mcq") as EngineType;
  const options = norm(input.options !== undefined ? input.options : rawFallback(cur.question_options));
  const optErr = validateOptionsForType(type, options.map((o) => ({ label: o.label, body: o.body, is_correct: o.is_correct, position: o.position })));
  if (optErr) throw new ApiError(400, optErr, "INVALID_OPTIONS");
  if (input.topicId) await topicChain(admin, input.topicId);
  if (input.status && !isAllowedEngineTransition(String(cur.engine_status ?? "draft") as EngineStatus, input.status as EngineStatus)) {
    throw new ApiError(400, `Cannot move status from ${String(cur.engine_status)} to ${String(input.status)}.`, "INVALID_TRANSITION");
  }
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.stem !== undefined) { updates.question_text = input.stem.trim(); updates.stem = input.stem.trim(); }
  if (input.type !== undefined) { const v = await vocab(admin, input.type, Number(input.difficulty ?? cur.difficulty)); updates.question_type_id = v.qt.id; updates.engine_type = input.type; }
  if (input.difficulty !== undefined) { const v = await vocab(admin, type, input.difficulty); updates.difficulty_level_id = v.dl.id; updates.difficulty = input.difficulty; }
  if (input.topicId !== undefined) updates.topic_id = input.topicId;
  if (input.subtopicId !== undefined) updates.subtopic_id = input.subtopicId;
  if (input.parentId !== undefined) updates.parent_id = input.parentId;
  if (input.skill !== undefined) updates.skill = input.skill;
  if (input.marks !== undefined) updates.marks = input.marks;
  if (input.negMarks !== undefined) { updates.negative_marks = input.negMarks; updates.neg_marks = input.negMarks; }
  if (input.estTimeSec !== undefined) { updates.time_seconds = input.estTimeSec; updates.est_time_sec = input.estTimeSec; }
  if (input.boardPattern !== undefined) updates.board_pattern = input.boardPattern;
  if (input.pyqYear !== undefined) updates.pyq_year = input.pyqYear;
  if (input.lang !== undefined) updates.lang = input.lang;
  if (input.status !== undefined) { updates.engine_status = input.status; updates.status = ENGINE_STATUS_TO_LEGACY[input.status]; updates.is_verified = input.status === "published" || input.status === "reviewed"; }
  if (input.source !== undefined) updates.source = input.source;
  if (input.tags !== undefined) updates.tags = input.tags;
  if (input.explanation !== undefined) updates.explanation = input.explanation?.trim() ? input.explanation.trim() : null;
  const { error: ue } = await admin.from("questions").update(updates).eq("id", id);
  if (ue) throw ue;
  if (input.options !== undefined) {
    await admin.from("question_options").delete().eq("question_id", id);
    if (options.length) {
      const rows = options.map((o) => ({ question_id: id, option_text: o.body, label: o.label, body: o.body, is_correct: o.is_correct, sort_order: o.position, position: o.position }));
      const { error: oe } = await admin.from("question_options").insert(rows);
      if (oe) throw oe;
    }
  }
  const merged = { ...(cur as object), ...input } as unknown as EngineQuestionDefaults & { explanation?: string };
  const answerJson = input.answer ?? buildAnswerJson(merged, options);
  const { data: ans } = await admin.from("question_answers").select("question_id").eq("question_id", id).maybeSingle();
  const expl = ((merged.explanation ?? "") as string).trim() || null;
  if (ans) await admin.from("question_answers").update({ answer_json: answerJson, rubric_json: input.rubric ?? {}, explanation: expl }).eq("question_id", id);
  else await admin.from("question_answers").insert({ question_id: id, answer_json: answerJson, rubric_json: input.rubric ?? {}, explanation: expl });
  await syncSideTables(admin, id, merged);
  return getEngineQuestion(admin, id);
}

/**
 * Keeps denormalised side tables in sync with the questions row:
 * question_tags (replace set), question_answers (upsert), question_stats (ensure row).
 */
async function syncSideTables(admin: Admin, questionId: string, input: EngineQuestionDefaults) {
  if (input.tags !== undefined) {
    await admin.from("question_tags").delete().eq("question_id", questionId);
    if (input.tags.length) {
      const rows = Array.from(new Set(input.tags.map((t) => t.trim()).filter(Boolean))).map((tag) => ({
        question_id: questionId,
        tag,
      }));
      if (rows.length) {
        const { error } = await admin.from("question_tags").insert(rows);
        if (error) throw error;
      }
    }
  }
  const options = norm(input.options);
  const answerJson = input.answer ?? buildAnswerJson(input, options);
  const { data: ans } = await admin.from("question_answers").select("question_id").eq("question_id", questionId).maybeSingle();
  const explanation = input.explanation?.trim() ? input.explanation.trim() : null;
  if (ans) {
    const { error } = await admin
      .from("question_answers")
      .update({ answer_json: answerJson, rubric_json: input.rubric ?? {}, explanation })
      .eq("question_id", questionId);
    if (error) throw error;
  } else {
    const { error } = await admin
      .from("question_answers")
      .insert({ question_id: questionId, answer_json: answerJson, rubric_json: input.rubric ?? {}, explanation });
    if (error) throw error;
  }
  const { data: stats } = await admin.from("question_stats").select("question_id").eq("question_id", questionId).maybeSingle();
  if (!stats) {
    const { error } = await admin.from("question_stats").insert({ question_id: questionId });
    if (error && error.code !== "23505") throw error;
  }
}

/**
 * CSV bulk import. Every row is validated before any insert (all-or-nothing),
 * rows resolve their topic by slug, and all questions land as `source='import'`
 * with the requested status (defaults to `draft` — imports are never
 * auto-published).
 */
export async function bulkCreateEngineQuestions(
  admin: Admin,
  userId: string,
  rows: BulkEngineQuestionRow[],
  defaultStatus: EngineStatus
) {
  const topicSlugs = Array.from(new Set(rows.map((r) => r.topic_slug).filter(Boolean)));
  const topicBySlug = new Map<string, { id: string; chapter_id: string | null }>();
  if (topicSlugs.length) {
    const { data: topics, error } = await admin.from("topics").select("id,slug,chapter_id").in("slug", topicSlugs);
    if (error) throw error;
    for (const t of topics ?? []) if (t.slug) topicBySlug.set(t.slug, { id: t.id, chapter_id: t.chapter_id });
  }

  const prepared: CreateEngineQuestionInput[] = [];
  const errors: string[] = [];
  rows.forEach((r, i) => {
    const rowNo = i + 1;
    const topic = r.topic_slug ? topicBySlug.get(r.topic_slug) : undefined;
    if (r.topic_slug && !topic) {
      errors.push(`Row ${rowNo}: unknown topic slug '${r.topic_slug}'.`);
      return;
    }
    let options: EngineOptionInput[] = [];
    if (r.options.trim()) {
      try {
        const parsed: unknown = JSON.parse(r.options);
        if (!Array.isArray(parsed)) throw new Error("not array");
        options = (parsed as Array<Record<string, unknown>>).map((o, idx) => ({
          label: typeof o.label === "string" ? o.label : String.fromCharCode(65 + idx),
          body: String(o.body ?? o.text ?? ""),
          is_correct: Boolean(o.is_correct ?? o.isCorrect ?? false),
          position: typeof o.position === "number" ? o.position : idx + 1,
        }));
      } catch {
        errors.push(`Row ${rowNo}: options must be a JSON array of {label,body,is_correct}.`);
        return;
      }
    }
    const optionErr = validateOptionsForType(r.type, options);
    if (optionErr) {
      errors.push(`Row ${rowNo}: ${optionErr}`);
      return;
    }
    let answer: CreateEngineQuestionInput["answer"] = {};
    if (r.answer_json.trim()) {
      try {
        answer = JSON.parse(r.answer_json) as CreateEngineQuestionInput["answer"];
      } catch {
        errors.push(`Row ${rowNo}: answer_json is not valid JSON.`);
        return;
      }
    }
    let rubric: CreateEngineQuestionInput["rubric"] = {};
    if (r.rubric_json.trim()) {
      try {
        rubric = JSON.parse(r.rubric_json) as CreateEngineQuestionInput["rubric"];
      } catch {
        errors.push(`Row ${rowNo}: rubric_json is not valid JSON.`);
        return;
      }
    }
    const tags = r.tags.split("|").map((t: string) => t.trim()).filter(Boolean).slice(0, 30);
    prepared.push({
      type: r.type,
      stem: r.stem,
      topicId: topic?.id ?? "",
      subtopicId: null,
      parentId: null,
      chapterId: topic?.chapter_id ?? "",
      subjectId: "",
      difficulty: r.difficulty as 1 | 2 | 3,
      skill: r.skill,
      marks: r.marks,
      negMarks: r.neg_marks,
      estTimeSec: r.est_time_sec,
      boardPattern: r.board_pattern,
      pyqYear: null,
      lang: "en",
      status: r.status ?? defaultStatus,
      source: "import",
      tags,
      options,
      answer,
      rubric,
      explanation: r.explanation,
    });
  });

  if (errors.length) {
    throw new ApiError(400, errors.slice(0, 10).join(" "), "BULK_VALIDATION_FAILED");
  }

  const ids: string[] = [];
  for (const row of prepared) {
    const q = await createEngineQuestion(admin, userId, row);
    ids.push(q.id);
  }
  return { created: ids.length, ids };
}

/**
 * Soft-archive: a question referenced by any frozen test instance is retired
 * (never hard-deleted, so past attempts keep their exact content). Unreferenced
 * questions are hard-deleted.
 */
export async function archiveEngineQuestion(admin: Admin, id: string) {
  const { data: refs, error } = await admin
    .from("test_instance_questions")
    .select("instance_id")
    .eq("question_id", id)
    .limit(1);
  if (error) throw error;
  if (refs && refs.length > 0) {
    const { error: ue } = await admin
      .from("questions")
      .update({ engine_status: "retired", status: "archived", is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (ue) throw ue;
    return { id, archived: true, mode: "retired" as const };
  }
  const { error: de } = await admin.from("questions").delete().eq("id", id);
  if (de) throw de;
  return { id, archived: true, mode: "deleted" as const };
}

/**
 * Review-queue transition: draft → reviewed → published (with rollback paths),
 * enforcing the state machine from vocab.ts and recording reviewer metadata.
 */
export async function transitionEngineQuestion(
  admin: Admin,
  id: string,
  to: EngineStatus,
  reviewerId: string,
  reviewNotes: string
) {
  const { data: cur, error } = await admin.from("questions").select("engine_status").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!cur) throw new ApiError(404, "Question not found.", "NOT_FOUND");
  const from = (cur.engine_status ?? "draft") as EngineStatus;
  if (!isAllowedEngineTransition(from, to)) {
    throw new ApiError(400, `Cannot move status from ${from} to ${to}.`, "INVALID_TRANSITION");
  }
  const { error: ue } = await admin
    .from("questions")
    .update({
      engine_status: to,
      status: ENGINE_STATUS_TO_LEGACY[to],
      is_verified: to === "published" || to === "reviewed",
      is_active: to !== "retired",
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes?.trim() ? reviewNotes.trim() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (ue) throw ue;
  return getEngineQuestion(admin, id);
}
