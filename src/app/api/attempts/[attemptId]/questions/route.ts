import { NextRequest } from "next/server";

import { ApiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAttemptState, serveAttemptQuestions } from "@/lib/engine/attempt-service";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/attempts/:attemptId/questions
 * The frozen paper, in the order it was generated.
 *
 * Questions come from `get_attempt_questions`, a SECURITY DEFINER function that
 * verifies ownership and strips is_correct, answer_json, rubric and explanation,
 * so a correct answer can never reach the browser during an attempt. The call is
 * made with the student's cookie-scoped client on purpose: inside that function
 * `auth.uid()` is the real user, so the ownership check actually runs. (With the
 * service role it would be NULL, and `v_user <> NULL` is NULL, so the check would
 * quietly pass for anyone.)
 *
 * The admin client is used only for the ownership pre-check, so an attempt that
 * is not yours fails with a clear 403 instead of a database error.
 */

type Ctx = { params: Promise<{ attemptId: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required", "UNAUTHORIZED");

    const { attemptId } = await params;
    const admin = createAdminClient();
    const attempt = await getAttemptState(admin, attemptId, session.user.id);

    const userClient = await createClient();
    const [questions, { data: savedAnswers, error: answerError }] = await Promise.all([
      serveAttemptQuestions(userClient, attemptId),
      admin
        .from("attempt_answers")
        .select("question_id,response_json,time_spent_sec,flagged")
        .eq("attempt_id", attemptId),
    ]);
    if (answerError) throw answerError;
    const answersByQuestion = new Map((savedAnswers ?? []).map((answer) => [answer.question_id, answer]));
    const hydratedQuestions = questions.map((question) => ({
      ...question,
      response: answersByQuestion.get(question.questionId) ?? null,
    }));
    return apiSuccess({ attempt, questions: hydratedQuestions, count: questions.length });
  } catch (error) {
    return handleApiError(error);
  }
}
