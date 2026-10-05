import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
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

type DatabaseError = { code?: unknown };

function databaseErrorResponse(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const code = (error as DatabaseError).code;
  if (typeof code !== "string") return null;

  switch (code) {
    case "23505":
      return apiError("A record with that code or slug already exists. Choose a unique value.", 409, "DUPLICATE_VALUE");
    case "23503":
      return apiError(
        "A selected related record does not exist, or this record is still in use. Refresh the form and check its selections.",
        400,
        "RELATED_RECORD_INVALID"
      );
    case "23502":
      return apiError("A required field is missing. Check the form and try again.", 400, "REQUIRED_FIELD_MISSING");
    case "22P02":
      return apiError("One of the submitted IDs or values is invalid. Refresh the form and reselect related records.", 400, "INVALID_VALUE");
    case "22001":
      return apiError("One of the submitted fields is longer than allowed.", 400, "FIELD_TOO_LONG");
    case "23514":
      return apiError("One of the submitted values is not allowed. Check the form values and try again.", 400, "VALUE_NOT_ALLOWED");
    case "42501":
      return apiError(
        "The database rejected this operation because of its server permissions. Check the Supabase server configuration.",
        503,
        "DATABASE_PERMISSION_DENIED"
      );
    case "42703":
    case "42P01":
    case "42883":
    case "PGRST202":
    case "PGRST204":
    case "PGRST205":
      return apiError(
        "The server database schema is incomplete or out of date. Apply the latest migrations and refresh the Supabase schema cache.",
        503,
        "DATABASE_SCHEMA_MISMATCH"
      );
    default:
      return null;
  }
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
  const databaseResponse = databaseErrorResponse(error);
  if (databaseResponse) {
    console.error("API database error:", error);
    return databaseResponse;
  }
  try {
    const requestId = randomUUID();
    console.error(`API Error [${requestId}]:`, error, error instanceof Error ? error.stack : undefined);
    return apiError(
      "Internal server error. Please contact support with the reference ID.",
      500,
      "INTERNAL_ERROR",
      { requestId }
    );
  } catch {
    return apiError("Internal server error", 500, "INTERNAL_ERROR");
  }
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

/** Canonical app origin used to validate browser-initiated requests. */
export function getAppOrigin(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    return new URL(appUrl).origin;
  } catch {
    return "http://localhost:3000";
  }
}

function normalizeOrigin(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

/**
 * Extra origins (e.g. "https://www.xophol.com") that are trusted in addition to
 * the canonical app origin. Configured explicitly via TRUSTED_ORIGINS so an
 * operator can permit known aliases without trusting every subdomain of the
 * app's registrable domain (which would be a CSRF bypass).
 */
function getTrustedOrigins(): string[] {
  return (process.env.TRUSTED_ORIGINS || "")
    .split(",")
    .map((value) => normalizeOrigin(value.trim()))
    .filter((value): value is string => Boolean(value));
}

/**
 * CSRF hardening for cookie-authenticated endpoints. When a browser sends an
 * `Origin` (or `Referer`) header it must belong to the app itself (or an
 * explicitly trusted alias); otherwise the request is rejected. Requests that
 * carry no origin header (server-to-server calls, `curl`, tests) pass through
 * unchanged. The check is only enforced in production so local proxies and
 * development hosts are never blocked.
 */
export function assertTrustedOrigin(request: NextRequest): void {
  const originHeader = request.headers.get("origin");
  const sourceOrigin =
    normalizeOrigin(originHeader) ||
    (request.headers.get("referer") ? normalizeOrigin(request.headers.get("referer")) : "");
  if (!sourceOrigin) return;

  const sourceHost = new URL(sourceOrigin).host.toLowerCase();
  const appHost = new URL(getAppOrigin()).host.toLowerCase();
  const requestHost = request.headers.get("host")?.toLowerCase();

  // Exact host (case-insensitive) is always trusted.
  if (sourceHost === appHost) return;
  if (requestHost && sourceHost === requestHost) return;
  if (getTrustedOrigins().some((origin) => new URL(origin).host.toLowerCase() === sourceHost)) return;

  // Do not block development/localhost traffic.
  if (process.env.NODE_ENV !== "production") return;

  // In production require an exact host match. Comparing only the registrable
  // domain (e.g. "app.example.com" vs "evil.example.com") let any subdomain of
  // the app's domain satisfy the check, which is a CSRF bypass.
  throw new ApiError(403, "Cross-site requests are not allowed.", "CSRF_PROTECTION");
}
