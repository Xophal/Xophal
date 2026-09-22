import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { requireVerifiedSession } from "@/lib/auth-policy";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Authentication required", 401, "UNAUTHORIZED");
    }

    const { data: profile } = await supabase.from("profiles").select("*, roles(code)").eq("id", user.id).maybeSingle();
    try {
      requireVerifiedSession(profile, user, { allowRoles: ["student"] });
    } catch (error) {
      return apiError(error instanceof Error ? error.message : "Authentication required", 403, "FORBIDDEN");
    }

    const { data, error } = await supabase
      .from("subscriptions")
      .select("id, status, starts_at, expires_at, plan_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return apiSuccess({ subscriptions: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
