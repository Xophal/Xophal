import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { getAttemptState } from "@/lib/engine/attempt-service";
import { createAdminClient } from "@/lib/supabase/admin";

const answerSchema = z.object({
  question_id: z.string().uuid(),
  selected_options: z.array(z.string().trim().min(1).max(10)).max(20).default([]),
  text_answer: z.string().max(10000).optional().nullable(),
  numerical_answer: z.number().finite().optional().nullable(),
  time_spent_sec: z.number().int().min(0).max(86400).default(0),
  flagged: z.boolean().default(false),
});
const answersSchema = z.object({ answers: z.array(answerSchema).max(500) });
type Params = { params: Promise<{ attemptId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
    const { attemptId } = await params;
    const payload = await validateBody(answersSchema, await request.json());
    const admin = createAdminClient();
    const attempt = await getAttemptState(admin, attemptId, session.user.id);
    if (attempt.status !== "in_progress") throw new ApiError(409, "This attempt is already closed.", "ATTEMPT_CLOSED");
    if (Date.now() >= new Date(attempt.deadlineAt).getTime()) {
      throw new ApiError(409, "This attempt has reached its time limit.", "ATTEMPT_EXPIRED");
    }

    const { data: papers, error: paperError } = await admin
      .from("test_instance_questions")
      .select("question_id,question_snapshot")
      .eq("instance_id", attempt.instanceId);
    if (paperError) throw paperError;
    const papersById = new Map((papers ?? []).map((paper) => [paper.question_id, paper]));

    for (const answer of payload.answers) {
      const paper = papersById.get(answer.question_id);
      if (!paper) throw new ApiError(400, "Answer contains a question outside this attempt.", "INVALID_QUESTION");
      const snapshot = paper.question_snapshot as { options?: Array<{ label: string | null }> };
      const allowedOptions = new Set((snapshot.options ?? []).map((option) => option.label).filter(Boolean));
      if ((answer.selected_options ?? []).some((label) => !allowedOptions.has(label))) {
        throw new ApiError(400, "Answer contains an option outside this question.", "INVALID_OPTION");
      }
    }

    if (new Set(payload.answers.map((answer) => answer.question_id)).size !== payload.answers.length) {
      throw new ApiError(400, "Answers must not contain duplicate questions.", "DUPLICATE_QUESTION");
    }

    if (payload.answers.length > 0) {
      const { error } = await admin.from("attempt_answers").upsert(
        payload.answers.map((answer) => ({
          attempt_id: attemptId,
          question_id: answer.question_id,
          response_json: {
            selected_options: answer.selected_options,
            text_answer: answer.text_answer ?? null,
            numerical_answer: answer.numerical_answer ?? null,
          },
          time_spent_sec: answer.time_spent_sec,
          flagged: answer.flagged,
        })),
        { onConflict: "attempt_id,question_id" }
      );
      if (error) throw error;
    }
    return apiSuccess({ saved: payload.answers.length });
  } catch (error) {
    return handleApiError(error);
  }
}
