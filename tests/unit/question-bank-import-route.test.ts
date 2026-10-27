import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminRole: vi.fn(),
  createAdminClient: vi.fn(),
  parseQuestionImportFile: vi.fn(),
  validateQuestionImportRows: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdminRole: mocks.requireAdminRole }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/admin/question-bank-import", () => ({
  buildQuestionImportLegacyId: vi.fn(() => "question-import:test"),
  parseQuestionImportFile: mocks.parseQuestionImportFile,
  validateQuestionImportRows: mocks.validateQuestionImportRows,
}));

import { POST } from "@/app/api/admin/question-bank/import/route";

function createImportRequest() {
  const form = new FormData();
  form.set("action", "import");
  form.set("file", new File(["csv"], "questions.csv", { type: "text/csv" }));
  return new NextRequest("http://localhost/api/admin/question-bank/import", {
    method: "POST",
    body: form,
  });
}

describe("question bank import route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminRole.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.parseQuestionImportFile.mockResolvedValue([{ question: "Existing question" }]);
    mocks.validateQuestionImportRows.mockReturnValue({
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      issues: [],
      rows: [{
        question: "Existing question",
        type: "single_correct",
        option_a: "A",
        option_b: "B",
        option_c: "C",
        option_d: "D",
        correctAnswers: ["A"],
        marks: 1,
        negative_marks: 0,
        time_seconds: 30,
        explanation: "",
      }],
    });
  });

  it("does not delete an existing question when updating its options fails", async () => {
    const typeQuery: Record<string, ReturnType<typeof vi.fn>> = {};
    typeQuery.select = vi.fn(() => typeQuery);
    typeQuery.in = vi.fn().mockResolvedValue({
      data: [{ id: "type-1", code: "single_correct" }],
      error: null,
    });

    const questionsQuery: Record<string, ReturnType<typeof vi.fn>> = {};
    questionsQuery.select = vi.fn(() => questionsQuery);
    questionsQuery.eq = vi.fn(() => questionsQuery);
    questionsQuery.maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "existing-question" },
      error: null,
    });
    questionsQuery.upsert = vi.fn(() => questionsQuery);
    questionsQuery.single = vi.fn().mockResolvedValue({
      data: { id: "existing-question" },
      error: null,
    });
    questionsQuery.delete = vi.fn(() => questionsQuery);

    const optionsQuery: Record<string, ReturnType<typeof vi.fn>> = {};
    optionsQuery.delete = vi.fn(() => optionsQuery);
    optionsQuery.eq = vi.fn().mockResolvedValue({ error: null });
    optionsQuery.insert = vi.fn().mockResolvedValue({
      error: new Error("option write failed"),
    });

    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "question_types") return typeQuery;
        if (table === "questions") return questionsQuery;
        if (table === "question_options") return optionsQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    });
    const logError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(createImportRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      success: false,
      code: "PARTIAL_IMPORT",
    });
    expect(body.error).toContain("Existing question data was not rolled back");
    expect(questionsQuery.delete).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalled();
    logError.mockRestore();
  });
});
