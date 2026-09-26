import { NextRequest, NextResponse } from "next/server";
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
  } catch {
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
 * Extra origins (e.g. "https://www.xophal.com") that are trusted in addition to
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
