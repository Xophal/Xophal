import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError } from "@/lib/api-utils";

export async function GET() {
  try {
    await requireAdminAuth();
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("mock_tests")
      .select("id, title, slug, description, instructions, duration_minutes, passing_marks, negative_marking, negative_marks_ratio, shuffle_questions, shuffle_options, show_solutions, allow_review, max_attempts, total_questions, total_marks, access_price, is_published, is_premium, is_active, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return apiSuccess(data ?? []);
  } catch (error) {
    return handleApiError(error);
  }
}
