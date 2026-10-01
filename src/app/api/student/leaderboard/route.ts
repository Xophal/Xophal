import { apiSuccess, ApiError, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("leaderboard_entries")
      .select("rank, total_xp, tests_completed, profiles(full_name)")
      .eq("user_id", session.user.id)
      .limit(1);
    if (error) throw error;
    return apiSuccess({ entries: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
