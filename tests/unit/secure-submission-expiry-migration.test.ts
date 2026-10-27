import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  join(process.cwd(), "supabase/migrations/050_secure_submission_expiry.sql"),
  "utf8"
);

describe("secure submission expiry migration", () => {
  it("forces server-side expiry behavior for both submission RPCs", () => {
    expect(MIGRATION).toMatch(
      /submit_test_attempt_with_caller_expiry\(\s*p_attempt_id,\s*p_responses,\s*FALSE\s*\)/i
    );
    expect(MIGRATION).toMatch(
      /submit_engine_attempt_with_caller_expiry\(\s*p_attempt_id,\s*p_answers,\s*FALSE\s*\)/i
    );
  });

  it("removes direct authenticated access to the renamed implementations", () => {
    expect(MIGRATION).toMatch(
      /REVOKE ALL ON FUNCTION public\.submit_test_attempt_with_caller_expiry\(UUID, JSONB, BOOLEAN\)\s+FROM PUBLIC, anon, authenticated/i
    );
    expect(MIGRATION).toMatch(
      /REVOKE ALL ON FUNCTION public\.submit_engine_attempt_with_caller_expiry\(UUID, JSONB, BOOLEAN\)\s+FROM PUBLIC, anon, authenticated/i
    );
  });
});
