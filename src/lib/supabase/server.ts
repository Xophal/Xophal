import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ApiError } from "@/lib/api-utils";
import { publicEnv } from "@/lib/env";

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

export async function createClient() {
  const supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (isPlaceholderValue(supabaseUrl) || isPlaceholderValue(anonKey)) {
    throw new ApiError(
      503,
      "Supabase is not configured for this session. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before using dashboard or content management features.",
      "SUPABASE_NOT_CONFIGURED"
    );
  }

  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component - ignore
          }
        },
      },
    }
  );
}
