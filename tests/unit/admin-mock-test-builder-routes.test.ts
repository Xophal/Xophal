import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdminRole: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdminRole: mocks.requireAdminRole }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { PATCH as updateMockTest } from "@/app/api/admin/mock-tests/[mockTestId]/route";
import { PATCH as assignQuestionSection } from "@/app/api/admin/mock-tests/[mockTestId]/questions/route";
import { POST as createSection } from "@/app/api/admin/mock-tests/[mockTestId]/sections/route";

const adminRoles = ["super_admin", "admin", "content_manager"];

function createRequest(url: string, method: string, body: unknown) {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin mock-test builder routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminRole.mockResolvedValue(undefined);
  });

  it("preserves instructions when updating other mock-test details", async () => {
    const updatePayloads: Array<Record<string, unknown>> = [];
    const updateQuery = {
      update: vi.fn((payload: Record<string, unknown>) => {
        updatePayloads.push(payload);
        return updateQuery;
      }),
      eq: vi.fn(() => updateQuery),
      select: vi.fn(() => updateQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "test-1" }, error: null }),
    };
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => updateQuery) });

    const response = await updateMockTest(
      createRequest("http://localhost/api/admin/mock-tests/test-1", "PATCH", {
        description: "Updated description",
      }),
      { params: Promise.resolve({ mockTestId: "test-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.requireAdminRole).toHaveBeenCalledWith(adminRoles);
    expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      description: "Updated description",
    }));
    expect(updatePayloads[0]).not.toHaveProperty("instructions");
  });

  it("returns a conflict if an edited slug violates the unique index", async () => {
    const updateQuery = {
      update: vi.fn(() => updateQuery),
      eq: vi.fn(() => updateQuery),
      select: vi.fn(() => updateQuery),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      }),
    };
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => updateQuery) });

    const response = await updateMockTest(
      createRequest("http://localhost/api/admin/mock-tests/test-1", "PATCH", { slug: "taken-slug" }),
      { params: Promise.resolve({ mockTestId: "test-1" }) }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "DUPLICATE_SLUG" });
  });

  it("limits section creation to content-authoring admin roles", async () => {
    const insertQuery = {
      insert: vi.fn(() => insertQuery),
      select: vi.fn(() => insertQuery),
      single: vi.fn().mockResolvedValue({ data: { id: "section-1" }, error: null }),
    };
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => insertQuery) });

    const response = await createSection(
      createRequest("http://localhost/api/admin/mock-tests/test-1/sections", "POST", { name: "Section 1" }),
      { params: Promise.resolve({ mockTestId: "test-1" }) }
    );

    expect(response.status).toBe(201);
    expect(mocks.requireAdminRole).toHaveBeenCalledWith(adminRoles);
  });

  it("rejects assigning a question to a section owned by another test", async () => {
    const sectionQuery = {
      select: vi.fn(() => sectionQuery),
      eq: vi.fn(() => sectionQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const questionQuery = {
      update: vi.fn(() => questionQuery),
      eq: vi.fn(() => questionQuery),
      select: vi.fn(() => questionQuery),
      maybeSingle: vi.fn(),
    };
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => table === "mock_test_sections" ? sectionQuery : questionQuery),
    });

    const response = await assignQuestionSection(
      createRequest("http://localhost/api/admin/mock-tests/test-1/questions", "PATCH", {
        question_id: "b5c45d74-0d62-45b0-a412-6c8c0b9cbb81",
        section_id: "68890bd3-b2e1-4fdb-b367-6ce0cc431fad",
      }),
      { params: Promise.resolve({ mockTestId: "test-1" }) }
    );

    expect(response.status).toBe(404);
    expect(questionQuery.update).not.toHaveBeenCalled();
  });
});
