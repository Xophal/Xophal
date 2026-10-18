import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const answerSchema = z.object({
  question_id: z.string().uuid(),
  response_json: z.object({
    selected_options: z.array(z.string().trim().min(1).max(10)).max(20).default([]),
    text_answer: z.string().max(10000).nullable().optional(),
    numerical_answer: z.number().finite().nullable().optional(),
  }),
  time_spent_sec: z.number().int().min(0).max(86400).default(0),
  flagged: z.boolean().default(false),
});
const submitSchema = z.object({
  answers: z.array(answerSchema).max(500),
  expired: z.boolean().default(false),
});
type Params = { params: Promise<{ attemptId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
    const { attemptId } = await params;
    const payload = await validateBody(submitSchema, await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("submit_engine_attempt", {
      p_attempt_id: attemptId,
      p_answers: payload.answers,
      p_expired: payload.expired,
    });
    if (error) {
      if (error.message.includes("not found")) throw new ApiError(404, "Attempt not found.", "ATTEMPT_NOT_FOUND");
      if (error.message.includes("Not your attempt") || error.message.includes("forbidden")) {
        throw new ApiError(403, "Forbidden.", "FORBIDDEN");
      }
      if (error.message.includes("expired")) throw new ApiError(409, "This attempt has reached its time limit.", "ATTEMPT_EXPIRED");
      if (error.message.includes("invalid option") || error.message.includes("outside this attempt")) {
        throw new ApiError(400, error.message, "INVALID_ANSWER");
      }
      throw error;
    }
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
