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

import { POST } from "@/app/api/admin/imports/process/route";

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
});
