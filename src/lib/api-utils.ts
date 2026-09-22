import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 400, code?: string, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { success: false, error: message, code, ...(extra ?? {}) },
    { status }
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return apiError(
      error.message,
      error.statusCode,
      error.code,
      error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : undefined
    );
  }
  try {
    console.error("API Error:", error, error instanceof Error ? error.stack : undefined);
  } catch (e) {
    // ignore logging failures
  }
  return apiError("Internal server error", 500, "INTERNAL_ERROR");
}

export async function validateBody<T>(schema: ZodSchema<T>, body: unknown): Promise<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError(400, result.error.errors[0]?.message || "Validation failed", "VALIDATION_ERROR");
  }
  return result.data;
}

export function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  };
}
