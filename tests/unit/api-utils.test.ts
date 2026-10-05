import { describe, expect, it } from "vitest";
import { ApiError, getPaginationParams, handleApiError, paginatedResponse, validateBody } from "@/lib/api-utils";
import { loginSchema } from "@/lib/validations";

describe("API utilities", () => {
  it("clamps pagination parameters to supported bounds", () => {
    expect(getPaginationParams(new URLSearchParams("page=-3&limit=999"))).toEqual({ page: 1, limit: 100, offset: 0 });
    expect(getPaginationParams(new URLSearchParams("page=3&limit=10"))).toEqual({ page: 3, limit: 10, offset: 20 });
  });

  it("returns pagination metadata", () => {
    expect(paginatedResponse(["a", "b"], 21, 2, 10)).toEqual({
      data: ["a", "b"],
      pagination: { page: 2, limit: 10, total: 21, totalPages: 3, hasMore: true },
    });
  });

  it("turns schema failures into API validation errors", async () => {
    await expect(validateBody(loginSchema, { email: "bad", password: "123" })).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
  });

  it("preserves expected API error details", async () => {
    const response = handleApiError(new ApiError(404, "Not found", "NOT_FOUND"));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ success: false, error: "Not found", code: "NOT_FOUND" });
  });

  it("returns a safe, actionable error for database uniqueness conflicts", async () => {
    const response = handleApiError({ code: "23505", message: "private database detail" });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "A record with that code or slug already exists. Choose a unique value.",
      code: "DUPLICATE_VALUE",
    });
  });

  it("identifies database schema errors without exposing raw database details", async () => {
    const response = handleApiError({ code: "PGRST204", message: "private database detail" });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "The server database schema is incomplete or out of date. Apply the latest migrations and refresh the Supabase schema cache.",
      code: "DATABASE_SCHEMA_MISMATCH",
    });
  });

  it("returns a reference ID for unexpected server errors", async () => {
    const response = handleApiError(new Error("private server detail"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({
      success: false,
      error: "Internal server error. Please contact support with the reference ID.",
      code: "INTERNAL_ERROR",
    });
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
