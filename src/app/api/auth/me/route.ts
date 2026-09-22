import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { ADMIN_ROLES } from "@/constants";
import { apiSuccess, handleApiError } from "@/lib/api-utils";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user || !user.email_confirmed_at) {
      return apiSuccess({ user: null, profile: null, isAdmin: false });
    }

    const profile = await ensureProfile(user);

    const roleCode = (profile as { roles?: { code?: string } } | null)?.roles?.code;

    return apiSuccess({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email,
      },
      profile,
      isAdmin: !!roleCode && ADMIN_ROLES.includes(roleCode as (typeof ADMIN_ROLES)[number]),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
