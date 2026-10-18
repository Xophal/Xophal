import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api-utils";

import type { ResolvedSection } from "./blueprint-service";
import { getBlueprint, loadPool } from "./blueprint-service";
import type { Candidate, GenerationWarning, PickedQuestion } from "./generator";
import { dailySeed, generateStatic, hashSeed } from "./generator";

type Admin = SupabaseClient;

export type FrozenInstance = {
  instanceId: string;
  blueprintId: string;
  seed: number;
  questions: Array<{ questionId: string; sectionId: string | null; position: number; marks: number; negMarks: number }>;
  warnings: GenerationWarning[];
  totalMarks: number;
};

/** Sum each generated question's section-specific marks. */
export function computeMaxMarks(
  sections: readonly ResolvedSection[],
  picks: readonly { sectionId: string | null }[]
): number {
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const total = picks.reduce((sum, pick) => sum + Number(sectionById.get(pick.sectionId ?? "")?.marks_per_q ?? 0), 0);
  return Math.round(total * 100) / 100;
}

/**
 * The student's recently-seen questions, most recent first, so the generator can
 * avoid repeating a paper the student has just sat. Read from the frozen
 * instances they have already attempted rather than from live question state.
 */
export async function loadRecentlySeen(admin: Admin, userId: string, limit = 200): Promise<string[]> {
  const { data, error } = await admin
    .from("test_instance_questions")
    .select("question_id,test_instances!inner(user_id,generated_at)")
    .eq("test_instances.user_id", userId)
    .order("generated_at", { ascending: false, referencedTable: "test_instances" })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Array<{ question_id: string }>).map((r) => r.question_id);
}

export type GenerateOptions = {
  /** Overrides the seed; omit for a random instance. */
  seed?: number;
  /** Deterministic per-date generation (daily quiz). */
  dateISO?: string;
  /** Skip the recently-seen exclusion (first attempt, or a tiny bank). */
  allowRepeat?: boolean;
  /** Freezes the instance under this user rather than leaving it shared. */
  userId?: string | null;
};

/**
 * Freezes a blueprint into a `test_instance` + `test_instance_questions`.
 *
 * The instance is immutable once written: later edits to the blueprint or to
 * any question in the bank never change an instance that already exists, which
 * is what makes a past attempt reproducible. Returns the seed alongside the
 * picks so the exact same paper can be regenerated for debugging.
 */
export async function generateInstance(
  admin: Admin,
  blueprintId: string,
  opts: GenerateOptions = {}
): Promise<FrozenInstance> {
  const blueprint = await getBlueprint(admin, blueprintId);
  const sections = blueprint.sections;
  if (sections.length === 0) {
    throw new ApiError(400, "This blueprint has no sections, so no paper can be generated.", "NO_SECTIONS");
  }

  const pool = await loadPool(admin);
  if (pool.length === 0) {
    throw new ApiError(400, "The question bank has no published questions yet.", "EMPTY_BANK");
  }

  const seed = opts.seed ?? dailySeed(opts.dateISO ?? new Date().toISOString().slice(0, 10), blueprint.slug);

  const recentlySeen = opts.userId ? await loadRecentlySeen(admin, opts.userId) : [];
  const allowRepeat = opts.allowRepeat ?? recentlySeen.length >= pool.length;

  const result = generateStatic(sections, pool, seed, { recentlySeen, allowRepeat }, blueprint.shuffle_questions);
  if (result.picks.length === 0) {
    throw new ApiError(
      400,
      "No published questions match this blueprint's filters.",
      "NO_MATCHING_QUESTIONS"
    );
  }

  const questionIds = result.picks.map((pick) => pick.questionId);
  const { data: questionRows, error: questionError } = await admin
    .from("questions")
    .select("id,engine_type,stem,topic_id,subtopic_id,parent_id,difficulty,skill,board_pattern,pyq_year,lang,question_options(id,label,body,position),question_answers(answer_json)")
    .in("id", questionIds);
  if (questionError) throw questionError;

  const snapshots = new Map(
    (questionRows ?? []).map((row) => {
      const question = row as typeof row & {
        id: string;
        engine_type: string;
        stem: string;
        question_options: Array<{ id: string; label: string | null; body: string | null; position: number | null }> | null;
        question_answers: Array<{ answer_json: Record<string, unknown> }> | { answer_json: Record<string, unknown> } | null;
      };
      const answer = Array.isArray(question.question_answers) ? question.question_answers[0] : question.question_answers;
      return [
        question.id,
        {
          question: {
            id: question.id,
            engine_type: question.engine_type,
            stem: question.stem,
            topic_id: question.topic_id,
            subtopic_id: question.subtopic_id,
            parent_id: question.parent_id,
            difficulty: question.difficulty,
            skill: question.skill,
            board_pattern: question.board_pattern,
            pyq_year: question.pyq_year,
            lang: question.lang,
            select_multiple: Array.isArray(answer?.answer_json.correct_options) && answer.answer_json.correct_options.length > 1,
            options: (question.question_options ?? []).map((option) => ({
              id: option.id,
              label: option.label,
              body: option.body,
              position: option.position,
            })),
          },
          answer: answer?.answer_json ?? {},
        },
      ] as const;
    })
  );
  if (snapshots.size !== questionIds.length) {
    throw new ApiError(409, "The question bank changed while generating this test. Please try again.", "QUESTION_BANK_CHANGED");
  }

  const { data: inst, error: ie } = await admin
    .from("test_instances")
    .insert([
      {
        blueprint_id: blueprintId,
        user_id: opts.userId ?? null,
        generated_at: new Date().toISOString(),
        seed,
        duration_sec: blueprint.duration_sec,
        slug: blueprint.slug,
        name: blueprint.name,
      },
    ])
    .select("id")
    .single();
  if (ie) throw ie;
  const instanceId = (inst as { id: string }).id;

  const rows = result.picks.map((p: PickedQuestion, i) => ({
    instance_id: instanceId,
    question_id: p.questionId,
    section_id: p.sectionId,
    position: i,
    marks: Number(sections.find((section) => section.id === p.sectionId)?.marks_per_q ?? 0),
    neg_marks: Number(sections.find((section) => section.id === p.sectionId)?.neg_marks ?? 0),
    question_snapshot: snapshots.get(p.questionId)?.question,
  }));
  const { error: qe } = await admin.from("test_instance_questions").insert(rows);
  if (qe) {
    // Never leave a half-written instance behind: it would look like a valid
    // (but incomplete) paper to the attempt engine.
    await admin.from("test_instances").delete().eq("id", instanceId);
    throw qe;
  }
  const { error: answerError } = await admin.from("test_instance_answers").insert(
    result.picks.map((pick) => ({
      instance_id: instanceId,
      question_id: pick.questionId,
      answer_json: snapshots.get(pick.questionId)?.answer ?? {},
    }))
  );
  if (answerError) {
    await admin.from("test_instances").delete().eq("id", instanceId);
    throw answerError;
  }

  return {
    instanceId,
    blueprintId,
    seed,
    questions: result.picks.map((p, i) => ({
      questionId: p.questionId,
      sectionId: p.sectionId,
      position: i,
      marks: rows[i].marks,
      negMarks: rows[i].neg_marks,
    })),
    warnings: result.warnings,
    totalMarks: computeMaxMarks(sections, result.picks),
  };
}

export type { Candidate };
export { hashSeed };
