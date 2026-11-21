import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("comprehensive RLS migration", () => {
  const migration = readFileSync(
    resolve(process.cwd(), "supabase/migrations/059_rls_every_public_table.sql"),
    "utf8"
  );
  const mockTestVisibilityMigration = readFileSync(
    resolve(process.cwd(), "supabase/migrations/063_fix_published_mock_test_visibility.sql"),
    "utf8"
  );
  const subscriptionAccessMigration = readFileSync(
    resolve(process.cwd(), "supabase/migrations/062_secure_subscription_test_access.sql"),
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

  it("restores owner-readable attempt and response policies", () => {
    expect(migration).toContain("test_attempts_owner_read_only");
    expect(migration).toContain("test_responses_owner_read_only");
    expect(migration).toContain("ta.user_id = auth.uid()");
  });

  it("keeps ebook fulfillment destinations outside public column grants", () => {
    expect(migration).toContain("ebook_listings column grant");
    expect(migration).toContain("GRANT SELECT (");
    expect(migration).not.toMatch(/ebook_listings[^]*external_product_url/);
  });

  it("allows published test discovery without exposing premium test content", () => {
    expect(mockTestVisibilityMigration).toContain(
      "GRANT EXECUTE ON FUNCTION public.can_access_mock_test(UUID, UUID) TO anon"
    );
    expect(mockTestVisibilityMigration).toContain(
      "GRANT EXECUTE ON FUNCTION public.is_admin() TO anon"
    );
    expect(mockTestVisibilityMigration).toMatch(/is_published = TRUE\s+AND is_active = TRUE/);
    expect(subscriptionAccessMigration).toContain(
      "auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id"
    );
  });
});
