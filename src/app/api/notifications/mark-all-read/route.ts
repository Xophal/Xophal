import { NextRequest } from "next/server";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required", "UNAUTHORIZED");

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("mark_all_user_notifications_read");
    if (error) throw error;
    return apiSuccess({ marked: true, count: data ?? 0 });
  } catch (error) {
    return handleApiError(error);
  }
}
