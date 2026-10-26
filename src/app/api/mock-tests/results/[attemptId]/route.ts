import { apiSuccess, ApiError, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export function sanitizeQuestionReview(
  question: {
    question_text?: string;
    explanation?: string | null;
    image_url?: string | null;
    topic_id?: string | null;
    chapter_id?: string | null;
    options?: Array<{ id: string; option_text: string; is_correct?: boolean | null }>;
  } | null | undefined,
  showSolutions: boolean
) {
  const options = Array.isArray(question?.options) ? question.options : [];

  return {
    question_text: question?.question_text ?? "",
    explanation: showSolutions ? (question?.explanation ?? null) : null,
    image_url: showSolutions ? (question?.image_url ?? null) : null,
    topic_id: question?.topic_id ?? null,
    chapter_id: question?.chapter_id ?? null,
    question_options: showSolutions
      ? options.map((option) => ({
          id: option.id,
          option_text: option.option_text,
          is_correct: Boolean(option.is_correct),
        }))
      : options.map((option) => ({
          id: option.id,
          option_text: option.option_text,
        })),
  };
}

export function sanitizeResponseReview(
  response: { is_correct?: boolean | null; marks_awarded?: number | null } | null | undefined,
  showSolutions: boolean
) {
  if (!showSolutions) return {};
  return {
    is_correct: response?.is_correct ?? null,
    marks_awarded: response?.marks_awarded ?? 0,
  };
}

export async function GET(_: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  try {
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
    const { attemptId } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("test_attempts")
      .select("id, mock_test_id, status, started_at, submitted_at, time_spent_seconds, total_questions, answered_count, correct_count, wrong_count, skipped_count, marks_obtained, total_marks, percentage, rank, percentile, mock_tests(show_solutions)")
      .eq("id", attemptId)
      .eq("user_id", session.user.id)
      .in("status", ["submitted", "expired"])
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new ApiError(404, "Result not found", "RESULT_NOT_FOUND");
    const mockTestSettings = ((data as any)?.mock_tests && Array.isArray((data as any).mock_tests)
      ? (data as any).mock_tests[0]
      : (data as any)?.mock_tests) ?? {};
    const showSolutions = Boolean((mockTestSettings as { show_solutions?: boolean } | undefined)?.show_solutions ?? false);
    const admin = createAdminClient();
    const [{ data: responses, error: responseError }, { data: papers, error: paperError }] = await Promise.all([
      admin
        .from("test_responses")
        .select("question_id, selected_option_ids, text_answer, numerical_answer, is_correct, marks_awarded")
        .eq("attempt_id", attemptId),
      admin
        .from("test_attempt_papers")
        .select("question_id, position, question_snapshot")
        .eq("attempt_id", attemptId)
        .order("position", { ascending: true }),
    ]);
    if (responseError) throw responseError;
    if (paperError) throw paperError;

    const responseByQuestion = new Map((responses ?? []).map((response) => [response.question_id, response]));
    const testResponses = (papers ?? []).map((paper) => {
      const question = paper.question_snapshot as {
        question_text?: string;
        explanation?: string | null;
        image_url?: string | null;
        topic_id?: string | null;
        chapter_id?: string | null;
        options?: Array<{ id: string; option_text: string; is_correct: boolean }>;
      };
      const response = responseByQuestion.get(paper.question_id);
      return {
        question_id: paper.question_id,
        selected_option_ids: response?.selected_option_ids ?? null,
        text_answer: response?.text_answer ?? null,
        numerical_answer: response?.numerical_answer ?? null,
        ...sanitizeResponseReview(response, showSolutions),
        questions: sanitizeQuestionReview(question, showSolutions),
      };
    });
    const answeredForAccuracy = data.correct_count + data.wrong_count;
    const topicBreakdown = new Map<string, { attempted: number; correct: number; marks: number }>();
    for (const response of testResponses) {
      const question = Array.isArray(response.questions) ? response.questions[0] : response.questions;
      const key = question?.topic_id || question?.chapter_id || "unassigned";
      const current = topicBreakdown.get(key) ?? { attempted: 0, correct: 0, marks: 0 };
      const wasAnswered = Boolean(
        response.selected_option_ids?.length ||
        response.text_answer ||
        response.numerical_answer != null
      );
      if (wasAnswered) current.attempted += 1;
      current.correct += response.is_correct ? 1 : 0;
      current.marks += Number(response.marks_awarded ?? 0);
      topicBreakdown.set(key, current);
    }
    return apiSuccess({
      ...data,
      test_responses: testResponses,
      accuracy: answeredForAccuracy > 0 ? Number(((data.correct_count / answeredForAccuracy) * 100).toFixed(2)) : 0,
      topicBreakdown: Array.from(topicBreakdown, ([topicId, values]) => ({ topicId, ...values, accuracy: values.attempted ? Number(((values.correct / values.attempted) * 100).toFixed(2)) : 0 })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
