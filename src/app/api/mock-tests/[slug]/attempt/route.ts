import { ApiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { canAccessPremiumContent } from "@/lib/auth-policy";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await requireAuth();
    if (!session?.profile) throw new ApiError(401, "Authentication required", "UNAUTHORIZED");

    const { slug } = await params;
    const adminClient = createAdminClient();
    const { data: test, error: testError } = await adminClient
      .from("mock_tests")
      .select("id, test_type_id, title, slug, description, subject_id, chapter_id, total_questions, total_marks, duration_minutes, passing_marks, negative_marking, negative_marks_ratio, shuffle_questions, shuffle_options, is_premium, is_published, year, instructions")
      .eq("slug", slug)
      .eq("is_published", true)
      .eq("is_active", true)
      .maybeSingle();

    if (testError) throw testError;
    if (!test) throw new ApiError(404, "Mock test not found", "TEST_NOT_FOUND");

    const { data: subscription } = await adminClient
      .from("subscriptions")
      .select("id, status, expires_at, is_active")
      .eq("user_id", session.user.id)
      .limit(1)
      .maybeSingle();

    const premiumAccess = canAccessPremiumContent(session.profile, session.user, subscription);
    if (test.is_premium && !premiumAccess.allowed) {
      throw new ApiError(403, premiumAccess.reason || "Premium access required", "PREMIUM_REQUIRED");
    }

    const { data: questionRows, error: questionError } = await adminClient
      .from("mock_test_questions")
      .select("question_id, sort_order, marks_override, questions(*, question_types(code), question_options(*))")
      .eq("mock_test_id", test.id)
      .order("sort_order", { ascending: true });

    if (questionError) throw questionError;
    const questions = (questionRows || [])
      .map((row) => {
        const question = Array.isArray(row.questions) ? row.questions[0] : row.questions;
        if (!question) return null;
        return {
          ...question,
          question_type: Array.isArray(question.question_types) ? question.question_types[0] : question.question_types,
          marks: row.marks_override ?? question.marks,
          options: (question.question_options || []).map((option: { is_correct?: boolean }) => ({
            ...option,
            is_correct: false,
          })),
        };
      })
      .filter(Boolean);

    if (questions.length === 0) throw new ApiError(400, "This mock test has no questions yet", "TEST_EMPTY");

    const { data: existingAttempt } = await adminClient
      .from("test_attempts")
      .select("id, started_at, status")
      .eq("user_id", session.user.id)
      .eq("mock_test_id", test.id)
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const attempt = existingAttempt || (await adminClient
      .from("test_attempts")
      .insert({
        user_id: session.user.id,
        mock_test_id: test.id,
        status: "in_progress",
        total_questions: questions.length,
        total_marks: questions.reduce((total, question) => total + Number(question.marks || 0), 0),
      })
      .select("id, started_at, status")
      .single()).data;

    if (!attempt) throw new ApiError(500, "Unable to start this mock test", "ATTEMPT_CREATE_FAILED");

    const { data: savedResponses } = await adminClient
      .from("test_responses")
      .select("question_id, selected_option_ids, text_answer, numerical_answer, time_spent_seconds, is_bookmarked, is_review_later, is_visited")
      .eq("attempt_id", attempt.id);

    return apiSuccess({
      attempt,
      test: { ...test, total_questions: questions.length, total_marks: questions.reduce((total, question) => total + Number(question.marks || 0), 0) },
      questions,
      responses: savedResponses ?? [],
    });
  } catch (error) {
    return handleApiError(error);
  }
}