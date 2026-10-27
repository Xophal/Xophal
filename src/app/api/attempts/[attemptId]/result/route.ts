import { NextRequest } from "next/server";
import { ApiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { getAttemptState } from "@/lib/engine/attempt-service";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ attemptId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
    const { attemptId } = await params;
    const admin = createAdminClient();
    const attempt = await getAttemptState(admin, attemptId, session.user.id);
    if (!["submitted", "expired", "graded"].includes(attempt.status)) {
      throw new ApiError(409, "This attempt has not been submitted yet.", "RESULT_NOT_READY");
    }

    const { data: blueprint, error: blueprintError } = await admin
      .from("blueprints")
      .select("source_mock_test_id")
      .eq("id", attempt.blueprintId)
      .maybeSingle();
    if (blueprintError) throw blueprintError;
    if (!blueprint) throw new ApiError(404, "Test definition not found.", "BLUEPRINT_NOT_FOUND");

    let reviewAllowed = true;
    if (blueprint.source_mock_test_id) {
      const { data: sourceTest, error: sourceTestError } = await admin
        .from("mock_tests")
        .select("show_solutions")
        .eq("id", blueprint.source_mock_test_id)
        .maybeSingle();
      if (sourceTestError) throw sourceTestError;
      if (!sourceTest) throw new ApiError(404, "Mock test not found.", "TEST_NOT_FOUND");
      reviewAllowed = Boolean(sourceTest.show_solutions);
    }

    const [{ data: rows, error: rowsError }, { data: answers, error: answersError }, solutionsResult] = await Promise.all([
      admin
        .from("test_instance_questions")
        .select("question_id,position,marks,neg_marks,question_snapshot")
        .eq("instance_id", attempt.instanceId)
        .order("position", { ascending: true }),
      admin
        .from("attempt_answers")
        .select("question_id,response_json,is_correct,marks_awarded,time_spent_sec,flagged")
        .eq("attempt_id", attemptId),
      reviewAllowed
        ? admin
            .from("test_instance_answers")
            .select("question_id,answer_json")
            .eq("instance_id", attempt.instanceId)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (rowsError) throw rowsError;
    if (answersError) throw answersError;
    if (solutionsResult.error) throw solutionsResult.error;

    const answersByQuestion = new Map((answers ?? []).map((answer) => [answer.question_id, answer]));
    const solutionsByQuestion = new Map((solutionsResult.data ?? []).map((solution) => [solution.question_id, solution.answer_json]));
    const questions = (rows ?? []).map((row) => ({
      question_id: row.question_id,
      position: row.position,
      marks: row.marks,
      neg_marks: row.neg_marks,
      question: reviewAllowed
        ? row.question_snapshot
        : { ...row.question_snapshot, explanation: null },
      answer: reviewAllowed ? solutionsByQuestion.get(row.question_id) ?? null : null,
      response: (() => {
        const response = answersByQuestion.get(row.question_id);
        if (!response || reviewAllowed) return response ?? null;
        return {
          ...response,
          is_correct: null,
          marks_awarded: null,
        };
      })(),
    }));

    return apiSuccess({ attempt, reviewAllowed, questions });
  } catch (error) {
    return handleApiError(error);
  }
}
