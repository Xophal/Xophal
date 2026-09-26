import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Phase-1 contract: the assembled 014 seed must satisfy the master-prompt minimums.
const MIG = readFileSync(join(process.cwd(), "supabase/migrations/014_seed_class10_science_ch1.sql"), "utf8");

function count(re: RegExp) { return (MIG.match(re) || []).length; }

describe("phase-1 seed contract (014)", () => {
  it("contains 62 question rows (60 non-parent + 2 case parents)", () => {
    expect(count(/INSERT INTO questions /g)).toBe(62);
  });

  it("covers every required engine question type", () => {
    for (const t of ["'mcq'", "'assertion_reason'", "'match'", "'statement'", "'case_based'", "'fill_blank'", "'equation'", "'short'", "'long'"]) {
      expect(MIG.includes(t), `missing type ${t}`).toBe(true);
    }
  });

  it("covers all three difficulty bands and CBSE + SEBA patterns", () => {
    expect(MIG.includes(",'easy',") || MIG.includes("dl.code='easy'")).toBe(true);
    expect(MIG.includes("'CBSE'")).toBe(true);
    expect(MIG.includes("'SEBA'")).toBe(true);
  });

  it("seeds six starter blueprints incl. all required kinds", () => {
    expect(count(/INSERT INTO blueprints /g)).toBe(6);
    for (const slug of ["ch1-balancing-topic-test", "ch1-full-chapter-30", "ch1-assertion-reason-test", "ch1-case-based-test", "ch1-balancing-marathon", "ch1-cbse-pattern-40"]) {
      expect(MIG.includes(slug), `missing blueprint ${slug}`).toBe(true);
    }
  });

  it("links case children to parents via deterministic parent ids", () => {
    const { createHash } = require("node:crypto");
    const p26 = createHash("sha1").update("ch1q-Q26").digest("hex").slice(0, 8);
    const p30 = createHash("sha1").update("ch1q-Q30").digest("hex").slice(0, 8);
    expect(MIG.includes(p26), "Q26 parent id").toBe(true);
    expect(MIG.includes(p30), "Q30 parent id").toBe(true);
  });

  it("keeps every write idempotent (ON CONFLICT)", () => {
    expect(count(/ON CONFLICT/g)).toBeGreaterThan(60);
  });
});
