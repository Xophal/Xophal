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

function validateRedisPair(
  value: { UPSTASH_REDIS_REST_URL?: string; UPSTASH_REDIS_REST_TOKEN?: string },
  context: z.RefinementCtx
) {
  const hasRedisUrl = Boolean(value.UPSTASH_REDIS_REST_URL);
  const hasRedisToken = Boolean(value.UPSTASH_REDIS_REST_TOKEN);

  if (hasRedisUrl !== hasRedisToken) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [hasRedisUrl ? "UPSTASH_REDIS_REST_TOKEN" : "UPSTASH_REDIS_REST_URL"],
      message: "Both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be provided together",
    });
  }
}

const serverEnvSchema = z.object(serverEnvShape).superRefine(validateRedisPair);
const startupEnvSchema = publicEnvSchema.extend(serverEnvShape).superRefine(validateRedisPair);

/** Server-only configuration. This module must never be imported by client code. */
export const serverEnv = serverEnvSchema.parse({
  SUPABASE_SERVICE_ROLE_KEY: normalizeOptionalString(process.env.SUPABASE_SERVICE_ROLE_KEY),
  RAZORPAY_WEBHOOK_SECRET: normalizeOptionalString(process.env.RAZORPAY_WEBHOOK_SECRET),
  RAZORPAY_KEY_ID: normalizeOptionalString(process.env.RAZORPAY_KEY_ID),
  RAZORPAY_KEY_SECRET: normalizeOptionalString(process.env.RAZORPAY_KEY_SECRET),
  UPSTASH_REDIS_REST_URL: normalizeOptionalString(process.env.UPSTASH_REDIS_REST_URL),
  UPSTASH_REDIS_REST_TOKEN: normalizeOptionalString(process.env.UPSTASH_REDIS_REST_TOKEN),
});

/** Called while Next loads its configuration so invalid deployments never boot. */
export function validateEnv() {
  return startupEnvSchema.parse({
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
  });
}
