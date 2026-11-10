import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canAccessLinkedMockTest } from "@/lib/engine/blueprint-access";

const MIGRATION = readFileSync(
  join(process.cwd(), "supabase/migrations/051_engine_fixed_mock_test_compatibility.sql"),
  "utf8"
);
const PUBLISH_INTEGRITY_MIGRATION = readFileSync(
  join(process.cwd(), "supabase/migrations/057_mock_test_publish_integrity.sql"),
  "utf8"
);

describe("legacy mock-test compatibility migration", () => {
  it("stores a protected fixed paper snapshot without duplicating question rows", () => {
    expect(MIGRATION).toMatch(/source_mock_test_id UUID/i);
    expect(MIGRATION).toMatch(/CREATE TABLE IF NOT EXISTS public\.blueprint_fixed_questions/i);
    expect(MIGRATION).toMatch(/question_id UUID NOT NULL REFERENCES public\.questions\(id\) ON DELETE RESTRICT/i);
    expect(MIGRATION).toMatch(/question_snapshot JSONB NOT NULL/i);
    expect(MIGRATION).toMatch(/answer_json JSONB NOT NULL/i);
    expect(MIGRATION).toMatch(/REVOKE ALL ON TABLE public\.blueprint_fixed_questions FROM PUBLIC, anon, authenticated/i);
  });

  describe("mock-test publishing integrity migration", () => {
    it("requires exact totals and active published questions before publication", () => {
      expect(PUBLISH_INTEGRITY_MIGRATION).toMatch(/BEFORE INSERT OR UPDATE OF is_published ON public\.mock_tests/i);
      expect(PUBLISH_INTEGRITY_MIGRATION).toMatch(/AFTER UPDATE OF is_active, duration_minutes, total_questions, total_marks ON public\.mock_tests/i);
      expect(PUBLISH_INTEGRITY_MIGRATION).toMatch(/v_linked_count <> v_valid_count/i);
      expect(PUBLISH_INTEGRITY_MIGRATION).toMatch(/v_linked_count <> NEW\.total_questions/i);
      expect(PUBLISH_INTEGRITY_MIGRATION).toMatch(/question\.status = 'published' AND question\.is_active IS TRUE/i);
    });

    it("unpublishes tests when their questions become unavailable or their links change", () => {
      expect(PUBLISH_INTEGRITY_MIGRATION).toMatch(/AFTER UPDATE OF status, is_active ON public\.questions/i);
      expect(PUBLISH_INTEGRITY_MIGRATION).toMatch(/AFTER INSERT OR UPDATE OF mock_test_id, question_id OR DELETE ON public\.mock_test_questions/i);
      expect(PUBLISH_INTEGRITY_MIGRATION).toMatch(/SET is_published = false/);
    });
  });

  it("limits automatic backfill to supported choice papers with complete answer options", () => {
    expect(MIGRATION).toMatch(/BOOL_AND\([\s\S]*qo\.is_correct IS TRUE[\s\S]*COUNT\(\*\)[\s\S]*>= 2/i);
    expect(MIGRATION).toMatch(/engine_type::TEXT IN \('mcq', 'assertion_reason'\)/i);
    expect(MIGRATION).toMatch(/mtq\.marks_override/);
    expect(MIGRATION).toMatch(/mt\.negative_marks_ratio/);
  });

  it("creates attempt rows through a serialized, server-only function", () => {
    expect(MIGRATION).toMatch(/pg_advisory_xact_lock/);
    expect(MIGRATION).toMatch(/v_attempt_count >= v_max_attempts/);
    expect(MIGRATION).toMatch(/REVOKE ALL ON FUNCTION public\.create_engine_attempt[\s\S]*FROM PUBLIC, anon, authenticated/i);
    expect(MIGRATION).toMatch(/GRANT EXECUTE ON FUNCTION public\.create_engine_attempt[\s\S]*TO service_role/i);
  });
});

describe("linked mock-test entitlement", () => {
  it("allows free tests without a paid entitlement", () => {
    expect(canAccessLinkedMockTest({
      isPremium: false,
      hasPremiumEntitlement: false,
      hasGrant: false,
    })).toBe(true);
  });

  it("requires an entitlement or a test-specific grant for premium tests", () => {
    expect(canAccessLinkedMockTest({
      isPremium: true,
      hasPremiumEntitlement: false,
      hasGrant: false,
    })).toBe(false);
    expect(canAccessLinkedMockTest({
      isPremium: true,
      hasPremiumEntitlement: true,
      hasGrant: false,
    })).toBe(true);
    expect(canAccessLinkedMockTest({
      isPremium: true,
      hasPremiumEntitlement: false,
      hasGrant: true,
    })).toBe(true);
  });
});
