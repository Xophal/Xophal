import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canAccessLinkedMockTest } from "@/lib/engine/blueprint-access";

const MIGRATION = readFileSync(
  join(process.cwd(), "supabase/migrations/051_engine_fixed_mock_test_compatibility.sql"),
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
