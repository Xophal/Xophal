/**
 * Attempt lifecycle for the engine: start/resume an attempt, read its state, and
 * serve its questions through the sanitized RPCs.
 *
 * Two Supabase clients are used on purpose:
 *
 * - writes (starting an attempt) go through the service-role client, because a
 *   frozen instance and its attempt row must be created together and the student
 *   has no RLS grant for either;
 * - reads go through the *caller's own* cookie-scoped client, because
 *   `get_attempt_questions` is SECURITY DEFINER and does its ownership check with
 *   `auth.uid()`. Calling it with the service role would make `auth.uid()` NULL,
 *   and `v_user <> NULL` evaluates to NULL, so the check would silently pass for
 *   anybody. Letting the database enforce it is the whole point of the RPC.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api-utils";

import { getBlueprint } from "./blueprint-service";
import { computeMaxMarks, generateInstance } from "./test-generator";

type Admin = SupabaseClient;

/** Grace window for finishing after the deadline, so a request in flight is not lost. */
export const SUBMIT_GRACE_SEC = 30;

export type AttemptState = {
  attemptId: string;
  instanceId: string;
  blueprintId: string;
  blueprintSlug: string;
  blueprintTitle: string;
  status: "in_progress" | "submitted" | "expired" | "graded";
  startedAt: string;
  deadlineAt: string;
  maxScore: number;
  durationSec: number;
  questionCount: number;
  /** True when an unfinished attempt was resumed instead of a new one created. */
  resumed: boolean;
};

export type ServedQuestion = {
  questionId: string;
  type: string;
  stem: string;
  marks: number;
  negMarks: number;
  position: number;
  options: Array<{ label: string | null; body: string | null; position: number | null }>;
};

/** The instance columns every read needs, with the question count folded in. */
type InstanceJoin = {
  blueprint_id: string;
  duration_sec: number;
  slug: string;
  name: string;
  test_instance_questions: Array<{ count: number }>;
};

const INSTANCE_JOIN =
  "test_instances!inner(blueprint_id,duration_sec,slug,name,test_instance_questions(count))";

const toMillis = (iso: string) => new Date(iso).getTime();

/**
 * What to do with a student's most recent attempt on this blueprint.
 *
 * - `resume`: still inside the deadline, so hand back the same frozen paper.
 * - `expire`: an attempt was left open past its deadline, so retire it and
 *   issue a new one.
 * - `new`: nothing usable (nothing open, or it was already submitted/graded).
 */
export function planForOpenAttempt(
  status: string | null,
  deadlineAt: string | null,
  now: number
): "resume" | "expire" | "new" {
  if (!status || !deadlineAt) return "new";
  if (status !== "in_progress") return "new";
  // The grace window is part of the deadline: a request already in flight when
  // the clock ran out must still land.
  return toMillis(deadlineAt) + SUBMIT_GRACE_SEC * 1000 > now ? "resume" : "expire";
}

function toState(
  row: {
    id: string;
    instance_id: string;
    status: string;
    started_at: string;
    deadline_at: string;
    max_score: number | null;
  },
  instance: InstanceJoin,
  resumed: boolean
): AttemptState {
  return {
    attemptId: row.id,
    instanceId: row.instance_id,
    blueprintId: instance.blueprint_id,
    blueprintSlug: instance.slug,
    blueprintTitle: instance.name,
    status: row.status as AttemptState["status"],
    startedAt: row.started_at,
    deadlineAt: row.deadline_at,
    maxScore: Number(row.max_score ?? 0),
    durationSec: instance.duration_sec,
    questionCount: instance.test_instance_questions?.[0]?.count ?? 0,
    resumed,
  };
}


/**
 * Starts an attempt on a blueprint, or resumes the one already in progress.
 *
 * Resuming matters on mobile: a student who refreshes, loses signal or closes the
 * tab must come back to the same frozen paper, not a newly generated one, and
 * must not lose the deadline they were given.
 */
export async function startAttempt(
  admin: Admin,
  userId: string,
  blueprintId: string,
  opts: { seed?: number; dateISO?: string } = {}
): Promise<AttemptState> {
  const blueprint = await getBlueprint(admin, blueprintId);
  const now = Date.now();

  const { data: open, error: openErr } = await admin
    .from("attempts")
    .select(`id,instance_id,status,started_at,deadline_at,max_score,${INSTANCE_JOIN}`)
    .eq("user_id", userId)
    .eq("test_instances.blueprint_id", blueprintId)
    .in("status", ["in_progress", "submitted"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (openErr) throw openErr;

  if (open) {
    const instance = open.test_instances as unknown as InstanceJoin;
    const plan = planForOpenAttempt(open.status, open.deadline_at, now);

    if (plan === "resume") return toState(open, instance, true);

    // The deadline passed while the attempt sat in_progress: retire it so it
    // cannot be resumed or submitted, then fall through and start a new one.
    if (plan === "expire") {
      await admin
        .from("attempts")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", open.id)
        .eq("status", "in_progress");
    }
  }

  const instance = await generateInstance(admin, blueprintId, {
    seed: opts.seed,
    dateISO: opts.dateISO,
    userId,
  });

  const deadlineAt = new Date(now + (blueprint.duration_sec + SUBMIT_GRACE_SEC) * 1000).toISOString();
  const maxScore = computeMaxMarks(blueprint.sections, instance.questions.length);

  const { data: attempt, error: attemptErr } = await admin
    .from("attempts")
    .insert({
      instance_id: instance.instanceId,
      user_id: userId,
      status: "in_progress",
      started_at: new Date(now).toISOString(),
      deadline_at: deadlineAt,
      max_score: maxScore,
      metadata: { seed: instance.seed, blueprint_slug: blueprint.slug, warnings: instance.warnings },
    })
    .select("id,started_at,deadline_at")
    .single();
  if (attemptErr) {
    // Never leave a frozen instance with no attempt: it would look like a paper a
    // student sat but never finished.
    await admin.from("test_instance_questions").delete().eq("instance_id", instance.instanceId);
    await admin.from("test_instances").delete().eq("id", instance.instanceId);
    throw attemptErr;
  }

  return {
    attemptId: attempt.id,
    instanceId: instance.instanceId,
    blueprintId,
    blueprintSlug: blueprint.slug,
    blueprintTitle: blueprint.name,
    status: "in_progress",
    startedAt: attempt.started_at,
    deadlineAt: attempt.deadline_at,
    maxScore,
    durationSec: blueprint.duration_sec,
    questionCount: instance.questions.length,
    resumed: false,
  };
}


/** Reads an attempt, refusing anything that is not the caller's own. */
export async function getAttemptState(admin: Admin, attemptId: string, userId: string): Promise<AttemptState> {
  const { data, error } = await admin
    .from("attempts")
    .select(`id,user_id,instance_id,status,started_at,deadline_at,max_score,${INSTANCE_JOIN}`)
    .eq("id", attemptId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "Attempt not found.", "ATTEMPT_NOT_FOUND");
  // Checked here as well as in the RPC: the RPC only guards question reads, and a
  // 403 that depends on every caller remembering to use the right client is not a
  // guard at all.
  if (data.user_id !== userId) throw new ApiError(403, "This is not your attempt.", "FORBIDDEN");

  return toState(data, data.test_instances as unknown as InstanceJoin, false);
}

/**
 * Serves the frozen paper through `get_attempt_questions`, which strips
 * is_correct, answer_json, rubric and explanation. Must be called with the
 * student's own client so the database enforces ownership.
 */
export async function serveAttemptQuestions(
  userClient: SupabaseClient,
  attemptId: string
): Promise<ServedQuestion[]> {
  const { data, error } = await userClient.rpc("get_attempt_questions", { p_attempt_id: attemptId });
  if (error) throw new ApiError(400, error.message, "SERVE_QUESTIONS_FAILED");

  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    questionId: String(r.question_id),
    type: String(r.engine_type),
    stem: String(r.stem ?? ""),
    marks: Number(r.marks ?? 0),
    negMarks: Number(r.neg_marks ?? 0),
    position: Number(r.position ?? 0),
    options: (Array.isArray(r.options) ? r.options : []) as ServedQuestion["options"],
  }));
}


