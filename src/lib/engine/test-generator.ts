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
  questions: Array<{ questionId: string; sectionId: string | null; position: number }>;
  warnings: GenerationWarning[];
  totalMarks: number;
};

/** Sum of marks across the frozen paper, using each section's marks_per_q. */
export function computeMaxMarks(sections: readonly ResolvedSection[], pickedCount: number): number {
  const total = sections.reduce((sum, s) => sum + Number(s.marks_per_q) * s.count, 0);
  // A relaxed section can come up short; report the marks actually available.
  return Math.round(Math.min(total, pickedCount * (sections[0] ? Number(sections[0].marks_per_q) : 1)) * 100) / 100;
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

  const { data: inst, error: ie } = await admin
    .from("test_instances")
    .insert([
      {
        blueprint_id: blueprintId,
        user_id: opts.userId ?? null,
        generated_at: new Date().toISOString(),
        seed,
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
  }));
  const { error: qe } = await admin.from("test_instance_questions").insert(rows);
  if (qe) {
    // Never leave a half-written instance behind: it would look like a valid
    // (but incomplete) paper to the attempt engine.
    await admin.from("test_instances").delete().eq("id", instanceId);
    throw qe;
  }

  return {
    instanceId,
    blueprintId,
    seed,
    questions: result.picks.map((p, i) => ({
      questionId: p.questionId,
      sectionId: p.sectionId,
      position: i,
    })),
    warnings: result.warnings,
    totalMarks: computeMaxMarks(sections, result.picks.length),
  };
}

export type { Candidate };
export { hashSeed };
