import { ApiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserEntitlement, isProductEntitled } from "@/lib/entitlements";

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

    const entitlement = await getUserEntitlement(session.user.id);

    const { data: grant } = await adminClient
      .from("test_access_grants")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("mock_test_id", test.id)
      .maybeSingle();

    const hasEntitlement = test.is_premium
      ? entitlement.isPaid && isProductEntitled(entitlement.productType, "premium")
      : true;

    if (test.is_premium && !hasEntitlement && !grant) {
      throw new ApiError(403, entitlement.reason || "Premium access required", "PREMIUM_REQUIRED");
    }

    const { data: startedAttempt, error: startError } = await adminClient.rpc("start_mock_test_attempt", {
      p_user_id: session.user.id,
      p_mock_test_id: test.id,
    });
    if (startError) {
      if (startError.message.includes("Maximum attempts reached")) {
        throw new ApiError(403, "You have reached the maximum number of attempts for this test.", "MAX_ATTEMPTS_REACHED");
      }
      if (startError.message.includes("no questions")) {
        throw new ApiError(400, "This mock test has no questions yet", "TEST_EMPTY");
      }
      if (startError.message.includes("Mock test not found")) {
        throw new ApiError(404, "Mock test not found", "TEST_NOT_FOUND");
      }
      throw startError;
    }
    if (!startedAttempt || typeof startedAttempt !== "object") {
      throw new ApiError(500, "Unable to start this mock test", "ATTEMPT_CREATE_FAILED");
    }
    const attemptData = startedAttempt as {
      id: string;
      started_at: string;
      status: string;
      duration_minutes: number;
      resumed: boolean;
    };

    const { data: paperRows, error: paperError } = await adminClient
      .from("test_attempt_papers")
      .select("question_id, position, marks, question_snapshot")
      .eq("attempt_id", attemptData.id)
      .order("position", { ascending: true });
    if (paperError) throw paperError;

    const questions = (paperRows ?? []).map((row) => {
      const question = row.question_snapshot as Record<string, unknown> & {
        question_options?: Array<Record<string, unknown>>;
        options?: Array<Record<string, unknown>>;
      };
      const options = question.options ?? question.question_options ?? [];
      return {
        ...question,
        marks: row.marks,
        options: options.map((option) => ({ ...option, is_correct: false })),
      };
    });
    if (questions.length === 0) throw new ApiError(400, "This mock test has no questions yet", "TEST_EMPTY");

    const { data: savedResponses, error: responseError } = await adminClient
      .from("test_responses")
      .select("question_id, selected_option_ids, text_answer, numerical_answer, time_spent_seconds, is_bookmarked, is_review_later, is_visited")
      .eq("attempt_id", attemptData.id);
    if (responseError) throw responseError;

    return apiSuccess({
      attempt: { id: attemptData.id, started_at: attemptData.started_at, status: attemptData.status },
      test: {
        ...test,
        duration_minutes: attemptData.duration_minutes,
        total_questions: questions.length,
        total_marks: questions.reduce((total, question) => total + Number(question.marks || 0), 0),
      },
      questions,
      responses: savedResponses ?? [],
    }, attemptData.resumed ? 200 : 201);
  } catch (error) {
    return handleApiError(error);
  }
}