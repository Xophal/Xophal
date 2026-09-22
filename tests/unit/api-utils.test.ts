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
});
