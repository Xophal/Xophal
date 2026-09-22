import { apiSuccess, handleApiError, ApiError } from "@/lib/api-utils";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  try {
    await requireAdminAuth();
    const { attemptId } = await params;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("test_attempts")
      .select("id, user_id, status, started_at, submitted_at, time_spent_seconds, total_questions, answered_count, correct_count, wrong_count, skipped_count, marks_obtained, total_marks, percentage, metadata, profiles(id, full_name, email), mock_tests(id, title, subjects(name)), test_responses(question_id, selected_option_ids, text_answer, numerical_answer, is_correct, marks_awarded, time_spent_seconds, question_snapshot)")
      .eq("id", attemptId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new ApiError(404, "Attempt not found", "NOT_FOUND");

    // prefer question_snapshot where available; indicate whether snapshots exist
    const hasSnapshots = (data.test_responses || []).every((r: any) => !!r.question_snapshot);

    return apiSuccess({ ...data, hasSnapshots });
  } catch (err) {
    return handleApiError(err);
  }
}
