import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("launch container configuration", () => {
  const dockerfile = readFileSync(resolve(process.cwd(), "Dockerfile"), "utf8");
  const compose = readFileSync(resolve(process.cwd(), "docker-compose.yml"), "utf8");
  const migration = readFileSync(
    resolve(process.cwd(), "supabase/migrations/062_remove_test_start_row_lock.sql"),
    "utf8"
  );

  it("builds Next.js in a builder stage and runs standalone output", () => {
    expect(dockerfile).toContain("AS builder");
    expect(dockerfile).toContain("RUN npm run build");
    expect(dockerfile).toContain(".next/standalone");
    expect(dockerfile).toContain("CMD [\"node\", \"server.js\"]");
  });

  it("passes browser-visible build arguments through Compose", () => {
    expect(compose).toContain("NEXT_PUBLIC_APP_URL");
    expect(compose).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(compose).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("removes shared mock-test row locking and guards concurrent starts", () => {
    expect(migration).toContain("WHERE id = p_mock_test_id AND is_active = true AND is_published = true;");
    expect(migration).not.toContain("WHERE id = p_mock_test_id AND is_active = true AND is_published = true\n  FOR UPDATE");
    expect(migration).toContain("uq_test_attempts_one_in_progress");
  });
});
