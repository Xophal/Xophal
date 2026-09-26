/**
 * Read-only verification of the Ch1 question-bank import (migration 017).
 * Prints row counts, the engine_status breakdown and a few integrity checks
 * against the configured Supabase project. Never writes.
 *
 *   node scripts/qbank_ch1/verify.cjs
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  process.exit(1);
}
const db = createClient(url, key);

const count = async (table, filter) => {
  let q = db.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: n, error } = await q;
  return error ? `ERROR: ${error.message}` : n;
};

(async () => {
  const { error: legacyCol } = await db.from("questions").select("legacy_id").limit(1);
  if (legacyCol) {
    console.error("Migration 017 is not applied yet: questions.legacy_id is missing ->", legacyCol.message);
  }

  const bank = (q) => q.like("legacy_id", "CR-%");
  const passages = (q) => q.like("legacy_id", "CP-%");

  console.log("taxonomy");
  console.log("  chapters (chemical-reactions):", await count("chapters", (q) => q.eq("code", "chemical-reactions")));
  console.log("  topics:", await count("topics"));
  console.log("  subtopics:", await count("subtopics"));

  console.log("question bank (legacy_id CR-*)");
  console.log("  questions:", await count("questions", bank));
  console.log("  case passages (CP-*):", await count("questions", passages));
  console.log("  answers:", await count("question_answers"));

  const { data: bankIds } = await db.from("questions").select("id").like("legacy_id", "CR-%");
  const ids = (bankIds ?? []).map((r) => r.id);
  const options = ids.length
    ? (await db.from("question_options").select("*", { count: "exact", head: true }).in("question_id", ids)).count
    : 0;
  console.log("  options:", options);

  // Integrity spot-checks that would catch a partially applied import.
  const head = async (build) => (await build).count ?? 0;
  console.log(
    "  case children linked to a parent:",
    await head(
      db
        .from("questions")
        .select("id", { count: "exact", head: true })
        .like("legacy_id", "CR-%")
        .not("parent_id", "is", null)
    )
  );
  console.log(
    "  questions with no topic (should be 0):",
    await head(
      db.from("questions").select("id", { count: "exact", head: true }).like("legacy_id", "CR-%").is("topic_id", null)
    )
  );
  console.log(
    "  questions with no subtopic (should be 0):",
    await head(
      db
        .from("questions")
        .select("id", { count: "exact", head: true })
        .like("legacy_id", "CR-%")
        .is("subtopic_id", null)
    )
  );
  console.log(
    "  objective questions missing an answer key (should be 0):",
    await head(
      db
        .from("question_answers")
        .select("question_id", { count: "exact", head: true })
        .is("answer_json", null)
    )
  );

  const { data: statuses } = await db.from("questions").select("engine_status, legacy_id");
  const byStatus = {};
  for (const r of statuses ?? []) {
    if (!String(r.legacy_id ?? "").startsWith("CR-")) continue;
    byStatus[r.engine_status ?? "null"] = (byStatus[r.engine_status ?? "null"] ?? 0) + 1;
  }
  console.log("  engine_status breakdown:", JSON.stringify(byStatus));

  const { data: types } = await db.from("questions").select("engine_type, legacy_id");
  const byType = {};
  for (const r of types ?? []) {
    if (!String(r.legacy_id ?? "").startsWith("CR-")) continue;
    byType[r.engine_type] = (byType[r.engine_type] ?? 0) + 1;
  }
  console.log("  engine_type breakdown:", JSON.stringify(byType, null, 0));

  const { data: sample } = await db
    .from("questions")
    .select("legacy_id,engine_type,stem,marks,est_time_sec,tags")
    .like("legacy_id", "CR-%")
    .order("legacy_id")
    .limit(3);
  for (const s of sample ?? []) console.log("  sample:", s.legacy_id, s.engine_type, s.marks + "m", s.est_time_sec + "s", JSON.stringify((s.stem ?? "").slice(0, 70)));
})();
