import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError } from "@/lib/api-utils";

export async function GET() {
  try {
    await requireAdminAuth();
    const admin = createAdminClient();
    const { data, error } = await admin.from("roles").select("id, code, name").order("created_at", { ascending: true });
    if (error) throw error;
    return apiSuccess(data ?? []);
  } catch (err) {
    return handleApiError(err);
  }
}
