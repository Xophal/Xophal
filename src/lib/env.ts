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

/** Configuration safe to expose to browser bundles. */
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
  // Google sign-in is opt-in: the button is only rendered when explicitly
  // enabled, because it requires the Google OAuth provider to be configured in
  // Supabase first. Unset/false keeps the button hidden.
  NEXT_PUBLIC_ENABLE_GOOGLE_AUTH: z
    .string()
    .optional()
    .transform((value) => value?.trim().toLowerCase() === "true"),
});

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: resolveSupabaseUrl(
    normalizeOptionalString(process.env.NEXT_PUBLIC_SUPABASE_URL),
    normalizeOptionalString(process.env.SUPABASE_URL)
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: resolveSupabaseAnonKey(
    normalizeOptionalString(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    normalizeOptionalString(process.env.SUPABASE_ANON_KEY)
  ),
  NEXT_PUBLIC_APP_URL: normalizeOptionalString(process.env.NEXT_PUBLIC_APP_URL) ?? "http://localhost:3000",
  NEXT_PUBLIC_ENABLE_GOOGLE_AUTH: normalizeOptionalString(process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH),
});
