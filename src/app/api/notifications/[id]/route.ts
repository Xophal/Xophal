import { NextRequest } from "next/server";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new ApiError(400, "Invalid notification ID", "VALIDATION_ERROR");
    }

    const supabase = await createClient();
    const { data: notification, error: lookupError } = await supabase
      .from("notifications")
      .select("id, user_id, is_global")
      .eq("id", id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!notification) throw new ApiError(404, "Notification not found", "NOTIFICATION_NOT_FOUND");

    const result = notification.is_global && !notification.user_id
      ? await supabase.from("notification_receipts").upsert(
          { notification_id: id, user_id: session.user.id, is_read: true, is_dismissed: true },
          { onConflict: "notification_id,user_id" }
        )
      : await supabase.from("notifications")
          .delete()
          .eq("id", id)
          .eq("user_id", session.user.id)
          .eq("is_global", false);
    if (result.error) throw result.error;

    return apiSuccess({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
