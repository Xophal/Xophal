import { z } from "zod";

function normalizeSupabaseUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed);
    const pathname = url.pathname.replace(/\/+$|\/rest\/v1\/?$/i, "");
    url.pathname = pathname || "/";

    if (url.pathname === "/") {
      return url.origin;
    }

    return `${url.origin}${url.pathname}`.replace(/\/$/, "");
  } catch {
    return trimmed;
  }
}

function resolveSupabaseUrl(value: string | undefined, fallback: string | undefined) {
  return normalizeSupabaseUrl(value ?? fallback);
}

function resolveSupabaseAnonKey(value: string | undefined, fallback: string | undefined) {
  return value ?? fallback;
}

function normalizeOptionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL")
    .default("https://placeholder.supabase.co"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required")
    .default("placeholder-anon-key"),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL must be a valid URL")
    .default("http://localhost:3000"),
});

const serverEnvShape = {
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required").optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),
  RAZORPAY_KEY_ID: z.string().min(1).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
};

const serverEnvSchema = z.object(serverEnvShape);
const startupEnvSchema = publicEnvSchema.extend(serverEnvShape);

/**
 * Redis is an optional integration, but a half-configured pair is always a
 * mistake: Upstash cannot authenticate with only a URL, and silently treating it
 * as "unconfigured" would quietly disable auth rate limiting. This is reported as
 * a warning rather than a thrown ZodError, because `validateEnv()` runs while
 * Next loads its config (i.e. during `next build`) and a runtime configuration
 * gap must never be able to block a deployment.
 */
function collectRedisPairWarning(value: {
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}): string[] {
  const hasRedisUrl = Boolean(value.UPSTASH_REDIS_REST_URL);
  const hasRedisToken = Boolean(value.UPSTASH_REDIS_REST_TOKEN);

  if (hasRedisUrl === hasRedisToken) {
    return [];
  }

  const missing = hasRedisUrl ? "UPSTASH_REDIS_REST_TOKEN" : "UPSTASH_REDIS_REST_URL";

  return [
    `Incomplete Upstash Redis configuration: ${missing} is missing. ` +
      "Both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set. " +
      "Until then rate limiting stays disabled and production auth routes will " +
      "return 503 RATE_LIMIT_NOT_CONFIGURED.",
  ];
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".") || "(root)";
    return `Invalid environment value for ${path}: ${issue.message}`;
  });
}

/** Server-only configuration. This module must never be imported by client code. */
export const serverEnv = serverEnvSchema.parse({
  SUPABASE_SERVICE_ROLE_KEY: normalizeOptionalString(process.env.SUPABASE_SERVICE_ROLE_KEY),
  RAZORPAY_WEBHOOK_SECRET: normalizeOptionalString(process.env.RAZORPAY_WEBHOOK_SECRET),
  RAZORPAY_KEY_ID: normalizeOptionalString(process.env.RAZORPAY_KEY_ID),
  RAZORPAY_KEY_SECRET: normalizeOptionalString(process.env.RAZORPAY_KEY_SECRET),
  UPSTASH_REDIS_REST_URL: normalizeOptionalString(process.env.UPSTASH_REDIS_REST_URL),
  UPSTASH_REDIS_REST_TOKEN: normalizeOptionalString(process.env.UPSTASH_REDIS_REST_TOKEN),
});

/**
 * Called while Next loads its configuration so misconfigurations are surfaced
 * loudly and early.
 *
 * This deliberately never throws: `next.config.ts` invokes it, so a throw here
 * aborts `next build` and turns a fixable environment-variable gap into a failed
 * deployment. Invalid values are reported as warnings instead, and the runtime
 * keeps enforcing the important invariants (see `src/lib/redis.ts`, where an
 * incomplete pair disables rate limiting, and the auth routes, which fail closed
 * with 503 RATE_LIMIT_NOT_CONFIGURED in production).
 */
export function validateEnv() {
  const raw = {
    NEXT_PUBLIC_SUPABASE_URL: resolveSupabaseUrl(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_URL
    ),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: resolveSupabaseAnonKey(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      process.env.SUPABASE_ANON_KEY
    ),
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    SUPABASE_SERVICE_ROLE_KEY: normalizeOptionalString(process.env.SUPABASE_SERVICE_ROLE_KEY),
    RAZORPAY_WEBHOOK_SECRET: normalizeOptionalString(process.env.RAZORPAY_WEBHOOK_SECRET),
    RAZORPAY_KEY_ID: normalizeOptionalString(process.env.RAZORPAY_KEY_ID),
    RAZORPAY_KEY_SECRET: normalizeOptionalString(process.env.RAZORPAY_KEY_SECRET),
    UPSTASH_REDIS_REST_URL: normalizeOptionalString(process.env.UPSTASH_REDIS_REST_URL),
    UPSTASH_REDIS_REST_TOKEN: normalizeOptionalString(process.env.UPSTASH_REDIS_REST_TOKEN),
  };

  const result = startupEnvSchema.safeParse(raw);
  const warnings = result.success ? collectRedisPairWarning(raw) : formatIssues(result.error);

  for (const warning of warnings) {
    console.warn(`[config] ${warning}`);
  }

  return result.success ? result.data : undefined;
}
