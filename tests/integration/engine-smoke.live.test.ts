/**
 * Live smoke test for the question engine.
 *
 * Unlike the other integration tests this one talks to a real Supabase project,
 * so it is opt-in and excluded from the default suite. Run it on its own:
 *
 *   npm run test:smoke
 *
 * The npm script name is used as the switch rather than an env var, so the same
 * command works on Windows and on Unix. It answers the question the unit tests
 * cannot: given the bank that is actually published, can the generator fill the
 * blueprints, and does freezing a paper behave? Everything it writes is rolled
 * back in afterAll.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { checkAvailability, getBlueprint, loadPool } from "@/lib/engine/blueprint-service";
import type { Candidate } from "@/lib/engine/generator";
import { generateInstance } from "@/lib/engine/test-generator";

// The credentials live in .env.local, which vitest does not load on its own.
loadEnv({ path: ".env.local" });
loadEnv();

const LIVE = process.env.SMOKE_LIVE === "1" || process.env.npm_lifecycle_event === "test:smoke";
const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Admin = ReturnType<typeof createClient>;

/**
 * The service-role client is untyped (no generated database.types), so PostgREST
 * rows come back as `never`. These narrow them to the shape each test reads:
 * `asRows` for `.select()` lists, `asRow` for `.maybeSingle()` / `.single()`.
 */
function asRows<T>(data: unknown): T[] {
  return (data ?? []) as T[];
}

function asRow<T>(data: unknown): T | undefined {
  return data == null ? undefined : (data as T);
}

type BlueprintRow = { id: string; slug: string; name: string };
type InstanceQuestionRow = { question_id: string; position: number };

describe.skipIf(!LIVE)("engine smoke test (live)", () => {
  let admin: Admin;
  let pool: Candidate[];
  const created: string[] = [];

  beforeAll(async () => {
    if (!URL || !KEY) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run the live smoke test.");
    admin = createClient(URL, KEY, { auth: { persistSession: false } });
    pool = await loadPool(admin);
  }, 30_000);

  afterAll(async () => {
    // Never leave a frozen instance behind: it would look like a real paper.
    for (const id of created) {
      await admin.from("test_instance_questions").delete().eq("instance_id", id);
      await admin.from("test_instances").delete().eq("id", id);
    }
  }, 30_000);

  // Live round-trips are far slower than an in-memory unit test.
  it("loads a published pool large enough to build a paper", { timeout: 30_000 }, () => {
    console.log(`  pool: ${pool.length} published questions`);
    expect(pool.length).toBeGreaterThan(50);
  });

  it("reports availability for every Ch1 blueprint", { timeout: 30_000 }, async () => {
    const { data: bps } = await admin.from("blueprints").select("id,slug,name").order("slug");
    const blueprints = asRows<BlueprintRow>(bps);

    expect(blueprints.length).toBeGreaterThan(0);

    for (const bp of blueprints) {
      const blueprint = await getBlueprint(admin, bp.id);
      const rows = checkAvailability(blueprint.sections, pool);
      const short = rows.filter((r) => !r.canFill);
      const totalExact = rows.reduce((s, r) => s + r.exact, 0);
      const totalWanted = rows.reduce((s, r) => s + r.requested, 0);
      console.log(
        `  ${bp.slug}: ${rows.length} sections, exact ${totalExact}/${totalWanted}` +
          (short.length ? ` | SHORT: ${short.map((s) => `${s.title}(${s.exact}/${s.requested})`).join(", ")}` : "")
      );
    }
  });

  it("freezes a paper and stores every pick in order", { timeout: 30_000 }, async () => {
    const { data: found } = await admin.from("blueprints").select("id,slug").eq("slug", "ch1-full-chapter-30").maybeSingle();
    const bp = asRow<BlueprintRow>(found);
    expect(bp?.id, "ch1-full-chapter-30 must exist").toBeTruthy();

    const instance = await generateInstance(admin, bp!.id, { seed: 12345, allowRepeat: true });
    created.push(instance.instanceId);

    console.log(
      `  froze ${instance.questions.length} questions, ${instance.totalMarks} marks, ` +
        `warnings: ${instance.warnings.length}`
    );

    expect(instance.seed).toBe(12345);
    expect(instance.questions.length).toBeGreaterThan(0);
    // Positions are contiguous from zero and no question is reused.
    expect(instance.questions.map((q) => q.position)).toEqual(instance.questions.map((_, i) => i));
    expect(new Set(instance.questions.map((q) => q.questionId)).size).toBe(instance.questions.length);

    const { data: frozen } = await admin
      .from("test_instance_questions")
      .select("question_id,position")
      .eq("instance_id", instance.instanceId)
      .order("position");
    expect(asRows<InstanceQuestionRow>(frozen).length).toBe(instance.questions.length);
  });

  // Two full generations against a remote database, while the rest of the suite
  // competes for the same connection pool - give it room.
  it("is reproducible: the same seed yields the same paper", { timeout: 90_000 }, async () => {
    const { data: found } = await admin.from("blueprints").select("id,slug").eq("slug", "ch1-full-chapter-30").maybeSingle();
    const bp = asRow<BlueprintRow>(found);
    expect(bp?.id, "ch1-full-chapter-30 must exist").toBeTruthy();
    const a = await generateInstance(admin, bp!.id, { seed: 777, allowRepeat: true });
    const b = await generateInstance(admin, bp!.id, { seed: 777, allowRepeat: true });
    created.push(a.instanceId, b.instanceId);
    expect(a.questions.map((q) => q.questionId)).toEqual(b.questions.map((q) => q.questionId));
  });
});
