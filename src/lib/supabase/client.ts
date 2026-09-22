import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

declare global {
  // store cached client on globalThis to avoid multiple instances during HMR
  var __xophal_supabase_client: SupabaseClient | undefined;
}

export function createClient() {
  if (globalThis.__xophal_supabase_client) {
    return globalThis.__xophal_supabase_client;
  }

  // Keep browser and server authentication state in the same cookie store.  The
  // plain Supabase JS browser client persists to localStorage, which leaves SSR
  // and middleware unable to reliably observe a newly-created session.
  const client = createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  globalThis.__xophal_supabase_client = client;

  return client;
}
