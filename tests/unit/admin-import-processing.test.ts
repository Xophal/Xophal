import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminRole: vi.fn(),
  createAdminClient: vi.fn(),
  job: {
    id: "job-1",
    user_id: "admin-1",
    entity_type: "notes",
    status: "VALIDATED",
    total_rows: 1,
    invalid_rows: 1,
    preview_data: [{ title: "A note", content: "Content" }],
  },
  claim: { id: "job-1" } as { id: string } | null,
}));

vi.mock("@/lib/auth", () => ({ requireAdminRole: mocks.requireAdminRole }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { POST, processJob } from "@/app/api/admin/imports/process/route";

function createRequest() {
  return new NextRequest("http://localhost/api/admin/imports/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId: "job-1" }),
  });
}

describe("admin import processing", () => {
  let update: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.job.status = "VALIDATED";
    mocks.job.invalid_rows = 1;
    mocks.job.total_rows = 1;
    mocks.job.preview_data = [{ title: "A note", content: "Content" }];
    mocks.claim = { id: "job-1" };
    mocks.requireAdminRole.mockResolvedValue({
      user: { id: "admin-1" },
      profile: { roles: [{ code: "admin" }] },
    });

    const query: Record<string, ReturnType<typeof vi.fn>> = {};
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.maybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: mocks.job, error: null })
      .mockImplementationOnce(async () => ({ data: mocks.claim, error: null }));
    update = vi.fn(() => query);
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => query),
        update,
      })),
    });
  });

  it("refuses a preview with validation errors before claiming or processing it", async () => {
    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("IMPORT_HAS_INVALID_ROWS");
    expect(update).not.toHaveBeenCalled();
  });

  it("only processes jobs that are still validated", async () => {
    mocks.job.invalid_rows = 0;
    mocks.job.status = "COMPLETED";

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("IMPORT_NOT_VALIDATED");
    expect(update).not.toHaveBeenCalled();
  });

  it("prevents a validated job from being claimed more than once", async () => {
    mocks.job.invalid_rows = 0;
    mocks.claim = null;

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("IMPORT_ALREADY_CLAIMED");
    expect(update).toHaveBeenCalledWith({ status: "IMPORTING" });
  });

  it("creates imported mock tests as drafts", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const adminClient = {
      from: vi.fn(() => ({ insert })),
    } as unknown as Parameters<typeof processJob>[0];

    await expect(processJob(adminClient, {
      entity_type: "mock_tests",
      user_id: "admin-1",
      preview_data: [{ title: "Imported test", is_published: true }],
    })).resolves.toBe(1);

    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({ title: "Imported test", is_published: false }),
    ]);
  });

  it("fails instead of reporting question rows complete when option writes fail", async () => {
    const questionsQuery = {
      insert: vi.fn(() => questionsQuery),
      select: vi.fn(() => questionsQuery),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "question-1" },
        error: null,
      }),
    };
    const optionsInsert = vi.fn().mockResolvedValue({ error: new Error("option write failed") });
    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === "questions") return questionsQuery;
        if (table === "question_options") return { insert: optionsInsert };
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as Parameters<typeof processJob>[0];

    await expect(processJob(adminClient, {
      entity_type: "questions",
      user_id: "admin-1",
      preview_data: [{
        question_type_id: "type-1",
        question_text: "Question?",
        option_a: "A",
      }],
    })).rejects.toThrow("option write failed");

    expect(optionsInsert).toHaveBeenCalledOnce();
  });
});
