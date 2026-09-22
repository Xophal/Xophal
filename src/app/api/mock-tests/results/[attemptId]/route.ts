import { apiSuccess, ApiError, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  try {
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
    const { attemptId } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("test_attempts")
      .select("id, mock_test_id, status, started_at, submitted_at, time_spent_seconds, total_questions, answered_count, correct_count, wrong_count, skipped_count, marks_obtained, total_marks, percentage, rank, percentile, mock_tests(show_solutions), test_responses(question_id, selected_option_ids, text_answer, numerical_answer, is_correct, marks_awarded, questions(question_text, explanation, image_url, topic_id, chapter_id, question_options(id, option_text, is_correct)))")
      .eq("id", attemptId)
      .eq("user_id", session.user.id)
      .in("status", ["submitted", "expired"])
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new ApiError(404, "Result not found", "RESULT_NOT_FOUND");
    const answeredForAccuracy = data.correct_count + data.wrong_count;
    const topicBreakdown = new Map<string, { attempted: number; correct: number; marks: number }>();
    for (const response of data.test_responses ?? []) {
      const question = Array.isArray(response.questions) ? response.questions[0] : response.questions;
      const key = question?.topic_id || question?.chapter_id || "unassigned";
      const current = topicBreakdown.get(key) ?? { attempted: 0, correct: 0, marks: 0 };
      current.attempted += 1;
      current.correct += response.is_correct ? 1 : 0;
      current.marks += Number(response.marks_awarded ?? 0);
      topicBreakdown.set(key, current);
    }
    return apiSuccess({
      ...data,
      accuracy: answeredForAccuracy > 0 ? Number(((data.correct_count / answeredForAccuracy) * 100).toFixed(2)) : 0,
      topicBreakdown: Array.from(topicBreakdown, ([topicId, values]) => ({ topicId, ...values, accuracy: values.attempted ? Number(((values.correct / values.attempted) * 100).toFixed(2)) : 0 })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
