import { NextRequest } from "next/server";
import { ApiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    if (!session) return new Response(null, { status: 401 });
    const { id } = await params;
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
          { notification_id: id, user_id: session.user.id, is_read: true, is_dismissed: true },
          { onConflict: "notification_id,user_id" }
        )
      : await supabase.from("notifications").delete().eq("id", id).eq("user_id", session.user.id);
    if (error) throw error;
    return apiSuccess({ id });
  } catch (err) {
    return handleApiError(err);
  }
}
