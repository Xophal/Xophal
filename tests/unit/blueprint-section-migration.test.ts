import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIG = readFileSync(
  join(process.cwd(), "supabase/migrations/049_blueprint_section_difficulty_mix.sql"),
  "utf8"
);

describe("blueprint section difficulty mix migration", () => {
  it("adds an idempotent JSONB difficulty mix with a backward-compatible default", () => {
    expect(MIG).toMatch(
      /ADD COLUMN IF NOT EXISTS difficulty_mix JSONB NOT NULL DEFAULT '\{\}'::JSONB/i
    );
  });
});
