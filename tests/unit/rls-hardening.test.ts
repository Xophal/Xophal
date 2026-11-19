import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("comprehensive RLS migration", () => {
  const migration = readFileSync(
    resolve(process.cwd(), "supabase/migrations/059_rls_every_public_table.sql"),
    "utf8"
  );

  it("enables and forces RLS for every public table", () => {
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("FROM pg_tables");
  });

  it("revokes direct engine attempt writes", () => {
    expect(migration).toContain("DROP POLICY IF EXISTS attempts_own_insert");
    expect(migration).toContain("DROP POLICY IF EXISTS attempts_own_update");
    expect(migration).toContain("DROP POLICY IF EXISTS attempt_answers_own_upsert");
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE ON TABLE");
  });

  it("denies anonymous table access unless explicitly granted", () => {
    expect(migration).toContain("REVOKE ALL ON TABLE %I.%I FROM PUBLIC, anon");
    expect(migration).toContain("GRANT USAGE ON SCHEMA public TO anon, authenticated");
  });

  it("skips missing tables with a notice when applying privilege updates", () => {
    expect(migration).toContain("IF to_regclass(format('public.%I', table_name)) IS NULL THEN");
    expect(migration).toContain("RAISE NOTICE 'Skipping authenticated SELECT grant");
    expect(migration).toContain("'payment_submission_events'");
  });
});
