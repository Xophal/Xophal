import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) return new Response(null, { status: 401 });
    const supabase = await createClient();
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", session.user.id).eq("is_read", false);
    if (error) throw error;
    return apiSuccess({ marked: true });
  } catch (err) {
    return handleApiError(err);
  }
}
