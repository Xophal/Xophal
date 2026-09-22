import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api-utils";
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
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", session.user.id);
    if (error) throw error;
    return apiSuccess({ id });
  } catch (err) {
    return handleApiError(err);
  }
}
