import { ApiError } from "@/lib/api-utils";

export function isSupabasePlaceholder(value?: string | null) {
  if (!value) return true;
  const normalized = value.trim();
  return (
    normalized === "" ||
    normalized === "YOUR_SUPABASE_PROJECT" ||
    normalized.includes("YOUR_SUPABASE") ||
    normalized.includes("placeholder") ||
    normalized === "YOUR_SUPABASE_ANON_KEY" ||
    normalized === "YOUR_SUPABASE_SERVICE_ROLE_KEY"
  );
}

export function ensureSupabaseRegistrationConfig() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (isSupabasePlaceholder(serviceRoleKey)) {
    throw new ApiError(
      503,
      "Registration is unavailable because Supabase is not configured for server-side admin operations. Set SUPABASE_SERVICE_ROLE_KEY before creating an account.",
      "SUPABASE_NOT_CONFIGURED"
    );
  }
}

export default ensureSupabaseRegistrationConfig;
