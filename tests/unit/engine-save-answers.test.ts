import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { PATCH } from "@/app/api/attempts/[attemptId]/answers/route";

const QUESTION_ID = "11111111-1111-4111-8111-111111111111";

function request(answers: unknown[]) {
  return new NextRequest("http://localhost/api/attempts/attempt-1/answers", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
}

describe("atomic engine answer saves", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ user: { id: "student-1" } });
    mocks.rpc.mockResolvedValue({ data: { saved: 1 }, error: null });
    mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
  });

  it("saves answers through the caller-scoped atomic RPC", async () => {
    const response = await PATCH(request([{
      question_id: QUESTION_ID,
      selected_options: ["A"],
      time_spent_sec: 12,
      flagged: true,
    }]), { params: Promise.resolve({ attemptId: "attempt-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ saved: 1 });
    expect(mocks.rpc).toHaveBeenCalledWith("save_engine_attempt_answers", {
      p_attempt_id: "attempt-1",
      p_answers: [{
        question_id: QUESTION_ID,
        selected_options: ["A"],
        text_answer: undefined,
        numerical_answer: undefined,
        time_spent_sec: 12,
        flagged: true,
      }],
    });
  });

  it("rejects duplicate question rows before calling the RPC", async () => {
    const response = await PATCH(request([
      { question_id: QUESTION_ID },
      { question_id: QUESTION_ID },
    ]), { params: Promise.resolve({ attemptId: "attempt-1" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("DUPLICATE_QUESTION");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("maps a closed attempt response to conflict", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Attempt is already closed" } });

    const response = await PATCH(request([{ question_id: QUESTION_ID }]), {
      params: Promise.resolve({ attemptId: "attempt-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("ATTEMPT_CLOSED");
  });

  it("locks and validates the attempt in the database without updating grading fields", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/054_atomic_engine_answer_saves.sql"),
      "utf8"
    );
    expect(migration).toMatch(/save_engine_attempt_answers/i);
    expect(migration).toMatch(/WHERE id = p_attempt_id[\s\S]*FOR UPDATE/i);
    expect(migration).toMatch(/v_attempt\.user_id IS DISTINCT FROM auth\.uid\(\)/i);
    expect(migration).toMatch(/v_attempt\.status <> 'in_progress'/i);
    expect(migration).toMatch(/NOW\(\) >= v_attempt\.deadline_at/i);
    expect(migration).toMatch(/ON CONFLICT \(attempt_id, question_id\) DO UPDATE SET/i);
    expect(migration).not.toMatch(/is_correct\s*=\s*EXCLUDED/i);
    expect(migration).not.toMatch(/marks_awarded\s*=\s*EXCLUDED/i);
  });
});
