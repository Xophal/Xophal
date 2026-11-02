import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  join(process.cwd(), "supabase/migrations/052_engine_attempt_write_hardening.sql"),
  "utf8"
);

describe("engine attempt write hardening migration", () => {
  it("removes client write policies and privileges for attempts and answers", () => {
    expect(MIGRATION).toMatch(/DROP POLICY IF EXISTS attempts_own_insert ON public\.attempts/i);
    expect(MIGRATION).toMatch(/DROP POLICY IF EXISTS attempts_own_update ON public\.attempts/i);
    expect(MIGRATION).toMatch(/DROP POLICY IF EXISTS attempt_answers_own_upsert ON public\.attempt_answers/i);
    expect(MIGRATION).toMatch(
      /REVOKE INSERT, UPDATE, DELETE[\s\S]*ON TABLE public\.attempts, public\.attempt_answers[\s\S]*FROM PUBLIC, anon, authenticated/i
    );
  });

  it("preserves server-side attempt and answer writes", () => {
    expect(MIGRATION).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE[\s\S]*ON TABLE public\.attempts, public\.attempt_answers[\s\S]*TO service_role/i
    );
  });
});
