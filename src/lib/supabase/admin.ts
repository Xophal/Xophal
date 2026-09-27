import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

// This helper is intentionally server-only by convention and must never be used
// from client components or browser bundles. A static `server-only` import is
// incompatible with the Vitest environment used here, so the runtime check is
// enforced by the server-side call sites instead.

export function createAdminClient() {
  if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured. Set it before using admin-only Supabase operations.");
  }

  return createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
