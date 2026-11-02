import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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

    if (new Set(payload.answers.map((answer) => answer.question_id)).size !== payload.answers.length) {
      throw new ApiError(400, "Answers must not contain duplicate questions.", "DUPLICATE_QUESTION");
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_engine_attempt_answers", {
      p_attempt_id: attemptId,
      p_answers: payload.answers,
    });
    if (error) {
      if (error.message.includes("Attempt not found")) {
        throw new ApiError(404, "Attempt not found.", "ATTEMPT_NOT_FOUND");
      }
      if (error.message.includes("Not your attempt")) {
        throw new ApiError(403, "Forbidden.", "FORBIDDEN");
      }
      if (error.message.includes("already closed")) {
        throw new ApiError(409, "This attempt is already closed.", "ATTEMPT_CLOSED");
      }
      if (error.message.includes("expired")) {
        throw new ApiError(409, "This attempt has reached its time limit.", "ATTEMPT_EXPIRED");
      }
      if (error.message.includes("outside this attempt")) {
        throw new ApiError(400, "Answer contains a question outside this attempt.", "INVALID_QUESTION");
      }
      if (error.message.includes("invalid option")) {
        throw new ApiError(400, "Answer contains an option outside this question.", "INVALID_OPTION");
      }
      if (error.message.includes("duplicate questions")) {
        throw new ApiError(400, "Answers must not contain duplicate questions.", "DUPLICATE_QUESTION");
      }
      if (error.message.includes("payload is invalid") || error.message.includes("Too many answers")) {
        throw new ApiError(400, "Answer payload is invalid.", "INVALID_ANSWER");
      }
      throw error;
    }

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
