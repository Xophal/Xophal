import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { isUserEmailVerified } from "@/lib/auth-policy";
import { isAdminRole } from "@/lib/roles";
import { apiSuccess, handleApiError } from "@/lib/api-utils";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return apiSuccess({ user: null, profile: null, isAdmin: false });
    }

    const profile = await ensureProfile(user);
    if (profile.is_active !== true) {
      return apiSuccess({ user: null, profile: null, isAdmin: false });
    }

    if (!isUserEmailVerified(user, profile)) {
      return apiSuccess({ user: null, profile: null, isAdmin: false });
    }

    return apiSuccess({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email,
      },
      profile,
      isAdmin: isAdminRole(profile),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
