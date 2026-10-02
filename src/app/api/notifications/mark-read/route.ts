import { NextRequest } from "next/server";
import { ApiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) return new Response(null, { status: 401 });
    const body = await request.json();
    const id = body?.id;
    if (!id) return new Response(JSON.stringify({ success: false, error: "Missing id" }), { status: 400 });

    const supabase = await createClient();
    const { data: notification, error: lookupError } = await supabase
      .from("notifications")
      .select("id, is_global")
      .eq("id", id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!notification) throw new ApiError(404, "Notification not found", "NOTIFICATION_NOT_FOUND");

    const { error } = notification.is_global
      ? await supabase.from("notification_receipts").upsert(
          { notification_id: id, user_id: session.user.id, is_read: true },
          { onConflict: "notification_id,user_id" }
        )
      : await supabase.from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", session.user.id);
    if (error) throw error;
    return apiSuccess({ id });
  } catch (err) {
    return handleApiError(err);
  }
}
