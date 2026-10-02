import { apiSuccess, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const session = await requireAuth();
    if (!session) return new Response(null, { status: 401 });
    const supabase = await createClient();
    const [{ error: personalError }, { data: globals, error: globalError }, { data: receipts, error: receiptError }] = await Promise.all([
      supabase.from("notifications").update({ is_read: true }).eq("user_id", session.user.id).eq("is_read", false),
      supabase.from("notifications").select("id").eq("is_global", true).is("user_id", null),
      supabase.from("notification_receipts").select("notification_id, is_dismissed").eq("user_id", session.user.id),
    ]);
    if (personalError || globalError || receiptError) throw personalError || globalError || receiptError;

    if (globals?.length) {
      const dismissedIds = new Set((receipts || []).filter((receipt) => receipt.is_dismissed).map((receipt) => receipt.notification_id));
      const { error } = await supabase.from("notification_receipts").upsert(
        globals.map(({ id }) => ({
          notification_id: id,
          user_id: session.user.id,
          is_read: true,
          is_dismissed: dismissedIds.has(id),
        })),
        { onConflict: "notification_id,user_id" }
      );
      if (error) throw error;
    }
    return apiSuccess({ marked: true });
  } catch (err) {
    return handleApiError(err);
  }
}
