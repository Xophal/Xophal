import { z } from "zod";

const FALLBACK_PUBLIC_SUPABASE_URL = "https://placeholder.supabase.co";
const FALLBACK_PUBLIC_SUPABASE_ANON_KEY = "placeholder-anon-key";
const FALLBACK_APP_URL = "http://localhost:3000";

function normalizeSupabaseUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const lower = trimmed.toLowerCase();
  if (lower.includes("placeholder") || lower.includes("your_supabase") || lower.includes("your-project")) {
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
  const normalized = normalizeSupabaseUrl(value ?? fallback);
  return normalized ?? FALLBACK_PUBLIC_SUPABASE_URL;
}

function resolveSupabaseAnonKey(value: string | undefined, fallback: string | undefined) {
  const candidate = normalizeOptionalString(value ?? fallback) ?? FALLBACK_PUBLIC_SUPABASE_ANON_KEY;
  return candidate.trim() || FALLBACK_PUBLIC_SUPABASE_ANON_KEY;
}

function normalizeOptionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Configuration safe to expose to browser bundles. */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL").default(FALLBACK_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required").default(FALLBACK_PUBLIC_SUPABASE_ANON_KEY),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL").default(FALLBACK_APP_URL),
  NEXT_PUBLIC_ENABLE_GOOGLE_AUTH: z.boolean().default(false),
});

function getPublicEnv() {
  const resolved = {
    NEXT_PUBLIC_SUPABASE_URL: resolveSupabaseUrl(
      normalizeOptionalString(process.env.NEXT_PUBLIC_SUPABASE_URL),
      normalizeOptionalString(process.env.SUPABASE_URL)
    ),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: resolveSupabaseAnonKey(
      normalizeOptionalString(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      normalizeOptionalString(process.env.SUPABASE_ANON_KEY)
    ),
    NEXT_PUBLIC_APP_URL: normalizeOptionalString(process.env.NEXT_PUBLIC_APP_URL) ?? FALLBACK_APP_URL,
    NEXT_PUBLIC_ENABLE_GOOGLE_AUTH: normalizeOptionalString(process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH)?.trim().toLowerCase() === "true",
  };

  const parsed = publicEnvSchema.safeParse(resolved);

  if (parsed.success) {
    return parsed.data;
  }

  const repaired = {
    ...resolved,
    NEXT_PUBLIC_SUPABASE_URL: resolved.NEXT_PUBLIC_SUPABASE_URL ?? FALLBACK_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: resolved.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? FALLBACK_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: resolved.NEXT_PUBLIC_APP_URL ?? FALLBACK_APP_URL,
    NEXT_PUBLIC_ENABLE_GOOGLE_AUTH: Boolean(resolved.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH),
  };

  console.warn("[env] Falling back to safe public Supabase defaults.", parsed.error.issues);

  return publicEnvSchema.parse(repaired);
}

export const publicEnv = getPublicEnv();
