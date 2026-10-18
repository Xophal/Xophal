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

    const [{ data: rows, error: rowsError }, { data: answers, error: answersError }, { data: solutions, error: solutionsError }] = await Promise.all([
      admin
        .from("test_instance_questions")
        .select("question_id,position,marks,neg_marks,question_snapshot")
        .eq("instance_id", attempt.instanceId)
        .order("position", { ascending: true }),
      admin
        .from("attempt_answers")
        .select("question_id,response_json,is_correct,marks_awarded,time_spent_sec,flagged")
        .eq("attempt_id", attemptId),
      admin
        .from("test_instance_answers")
        .select("question_id,answer_json")
        .eq("instance_id", attempt.instanceId),
    ]);
    if (rowsError) throw rowsError;
    if (answersError) throw answersError;
    if (solutionsError) throw solutionsError;

    const answersByQuestion = new Map((answers ?? []).map((answer) => [answer.question_id, answer]));
    const solutionsByQuestion = new Map((solutions ?? []).map((solution) => [solution.question_id, solution.answer_json]));
    const questions = (rows ?? []).map((row) => ({
      question_id: row.question_id,
      position: row.position,
      marks: row.marks,
      neg_marks: row.neg_marks,
      question: row.question_snapshot,
      answer: solutionsByQuestion.get(row.question_id) ?? null,
      response: answersByQuestion.get(row.question_id) ?? null,
    }));

    return apiSuccess({ attempt, questions });
  } catch (error) {
    return handleApiError(error);
  }
}
