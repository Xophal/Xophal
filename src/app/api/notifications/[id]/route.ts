import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    if (!session) return new Response(null, { status: 401 });
    const { id } = await params;
    const supabase = await createClient();
    const { error } = await supabase.from("notifications").delete().eq("id", id).eq("user_id", session.user.id);
    if (error) throw error;
    return apiSuccess({ id });
  } catch (err) {
    return handleApiError(err);
  }
}
