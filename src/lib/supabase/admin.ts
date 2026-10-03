import { createClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api-utils";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

function isPlaceholderValue(value?: string | null) {
  if (!value) return true;
  const normalized = value.trim();
  return (
    normalized === "" ||
    normalized === "YOUR_SUPABASE_PROJECT" ||
    normalized === "YOUR_SUPABASE_ANON_KEY" ||
    normalized === "YOUR_SUPABASE_SERVICE_ROLE_KEY" ||
    normalized.includes("YOUR_SUPABASE") ||
    normalized.includes("placeholder") ||
    normalized.includes("your_supabase") ||
    normalized.includes("your-project")
  );
}

// This helper is intentionally server-only by convention and must never be used
// from client components or browser bundles. A static `server-only` import is
// incompatible with the Vitest environment used here, so the runtime check is
// enforced by the server-side call sites instead.

export function createAdminClient() {
  const supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
  const anonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";
  const serviceRoleKey = serverEnv.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-service-role-key";

  if (isPlaceholderValue(supabaseUrl) || isPlaceholderValue(serviceRoleKey) || isPlaceholderValue(anonKey)) {
    throw new ApiError(
      503,
      "Supabase is not configured for content creation. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY before creating boards, classes, mock tests, blogs or eBooks.",
      "SUPABASE_NOT_CONFIGURED"
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
