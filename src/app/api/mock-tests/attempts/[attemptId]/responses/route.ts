import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, ApiError, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const responseSchema = z.object({
  question_id: z.string().uuid(),
  selected_option_ids: z.array(z.string().uuid()).optional(),
  text_answer: z.string().nullable().optional(),
  numerical_answer: z.number().nullable().optional(),
  time_spent_seconds: z.number().int().min(0).default(0),
  is_bookmarked: z.boolean().default(false),
  is_review_later: z.boolean().default(false),
  is_visited: z.boolean().default(false),
});

const saveSchema = z.object({ responses: z.array(responseSchema).max(500) });

type Params = { params: Promise<{ attemptId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
    const { attemptId } = await params;
    const { responses } = await validateBody(saveSchema, await request.json());
    const admin = createAdminClient();
    const { data: attempt } = await admin.from("test_attempts").select("id, user_id, status").eq("id", attemptId).maybeSingle();
    if (!attempt) throw new ApiError(404, "Attempt not found", "ATTEMPT_NOT_FOUND");
    if (attempt.user_id !== session.user.id) throw new ApiError(403, "Forbidden", "FORBIDDEN");
    if (attempt.status !== "in_progress") throw new ApiError(409, "This attempt is already closed", "ATTEMPT_CLOSED");

    const { error } = await admin.from("test_responses").upsert(
      responses.map((response) => ({ attempt_id: attemptId, ...response })),
      { onConflict: "attempt_id,question_id" }
    );
    if (error) throw error;
    return apiSuccess({ saved: responses.length });
  } catch (error) {
    return handleApiError(error);
  }
}
