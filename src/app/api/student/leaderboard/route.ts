import { apiSuccess, ApiError, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
    const admin = createAdminClient();
    const { data, error } = await admin.from("leaderboard_entries").select("rank, total_xp, tests_completed, profiles(full_name)").order("rank", { ascending: true }).limit(20);
    if (error) throw error;
    return apiSuccess({ entries: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
