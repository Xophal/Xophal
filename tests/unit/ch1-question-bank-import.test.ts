import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseCsvRows } from "@/lib/engine/question-schema";

/**
 * Contract test for the generated Ch1 question-bank migration (017).
 *
 * It asserts the CSV source and the generated SQL agree, and that the
 * migration can never publish anything. Run `npm run qb:build` first if the
 * CSVs change - the SQL is a build artifact, so a stale artifact fails here.
 */
const MIG = readFileSync(join(process.cwd(), "supabase/migrations/017_question_bank_ch1_import.sql"), "utf8");
const DATA = join(process.cwd(), "docs/imports/ch1-class10-science");

const csv = (file: string) => parseCsvRows(readFileSync(join(DATA, file), "utf8"));
const taxonomy = csv("taxonomy.csv");
const questions = csv("questions.csv");
const options = csv("options.csv");
const passages = csv("case_passages.csv");

const count = (re: RegExp) => (MIG.match(re) ?? []).length;

describe("ch1 question bank CSV source", () => {
  it("parses with the app's own CSV parser (quoted commas, embedded newlines)", () => {
    expect(questions).toHaveLength(207);
    expect(options).toHaveLength(576);
    expect(passages).toHaveLength(7);
    expect(taxonomy.filter((r) => r.level === "topic")).toHaveLength(7);
    expect(taxonomy.filter((r) => r.level === "subtopic")).toHaveLength(28);
  });

  it("keeps chemical subscripts intact in the option text", () => {
    const equation = options.find((o) => o.text.includes("\u2082"));
    expect(equation?.text).toMatch(/\u2081|\u2082|\u2083/);
  });

  it("has no replacement characters (the Desktop copy of options.csv was corrupted)", () => {
    for (const f of ["questions.csv", "options.csv", "taxonomy.csv", "case_passages.csv"]) {
      expect(readFileSync(join(DATA, f), "utf8")).not.toContain("\uFFFD");
    }
  });

  it("covers all nine engine question types", () => {
    const types = new Set(questions.map((r) => r.type));
    for (const t of ["mcq", "assertion_reason", "match", "statement", "case_based", "fill_blank", "equation", "short", "long"]) {
      expect(types.has(t), `missing type ${t}`).toBe(true);
    }
  });

  it("gives every case_based child a real parent passage", () => {
    const ids = new Set(passages.map((p) => p.passage_id));
    for (const r of questions.filter((x) => x.type === "case_based")) {
      expect(ids.has(r.parent_id), `${r.question_id} -> ${r.parent_id}`).toBe(true);
    }
  });
});

describe("generated migration 017", () => {
  it("inserts every question, passage and option exactly once", () => {
    expect(count(/INSERT INTO questions \(/g)).toBe(questions.length + passages.length);
    expect(count(/INSERT INTO question_options \(/g)).toBe(options.length);
    expect(count(/INSERT INTO question_answers \(/g)).toBe(questions.length);
    expect(count(/INSERT INTO topics \(/g)).toBe(7);
    expect(count(/INSERT INTO subtopics \(/g)).toBe(28);
  });

  it("does not split an answer on commas (equation conditions contain them)", () => {
    // CR-T7-026's answer is "6CO2 + 6H2O -> C6H12O6 + 6O2 (sunlight, chlorophyll)".
    // A comma-aware split would truncate it at "(sunlight".
    const row = questions.find((r) => r.question_id === "CR-T7-026");
    expect(row?.answer_text).toContain("chlorophyll");
    expect(MIG).toContain("(sunlight, chlorophyll)");
    // The truncated form a comma split would have produced must not appear.
    expect(MIG).not.toContain('"(sunlight"');
  });

  it("stamps every CSV id into questions.legacy_id", () => {
    for (const r of questions) expect(MIG.includes(`'${r.question_id}'`), r.question_id).toBe(true);
    for (const p of passages) expect(MIG.includes(`'${p.passage_id}'`), p.passage_id).toBe(true);
  });

  it("adds the legacy_id column and its unique index for idempotent re-imports", () => {
    expect(MIG).toContain("ALTER TABLE questions ADD COLUMN IF NOT EXISTS legacy_id TEXT");
    expect(MIG).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_legacy_id");
  });

  it("keeps every write idempotent", () => {
    expect(count(/ON CONFLICT/g)).toBeGreaterThan(1000);
    expect(count(/DELETE FROM question_options/g)).toBe(144);
  });

  it("never publishes anything", () => {
    // 'published' may only appear in comments and in the verification query.
    const offending = MIG.split("\n").filter(
      (l) =>
        l.includes("published") &&
        !l.trim().startsWith("--") &&
        !l.includes("RAISE NOTICE") &&
        !l.includes("INTO v_pub")
    );
    expect(offending).toEqual([]);
  });

  it("lands every question and passage as draft and unverified", () => {
    expect(MIG).toContain("'draft','ai',");
    expect(count(/is_verified=false, status='draft', engine_status='draft'/g)).toBe(
      questions.length + passages.length
    );
  });

  it("resolves taxonomy through the cbse class-10 science chapter", () => {
    expect(MIG).toContain("b.code='cbse' AND c.code='class-10' AND s.code='science' AND ch.code='chemical-reactions'");
    expect(MIG).toContain("RAISE EXCEPTION 'migration 013 must be applied before 017'");
  });

  it("ends with a verification report", () => {
    expect(MIG).toContain("QBANK017: questions=");
  });
});
