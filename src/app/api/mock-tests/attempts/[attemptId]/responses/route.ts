import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, ApiError, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const responseSchema = z.object({
  question_id: z.string().uuid(),
  selected_option_ids: z.array(z.string().uuid()).max(20).optional(),
  text_answer: z.string().max(10000).nullable().optional(),
  numerical_answer: z.number().finite().nullable().optional(),
  time_spent_seconds: z.number().int().min(0).max(86400).default(0),
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
    const { data: attempt } = await admin
      .from("test_attempts")
      .select("id, user_id, status, started_at, mock_test_id, metadata")
      .eq("id", attemptId)
      .maybeSingle();
    if (!attempt) throw new ApiError(404, "Attempt not found", "ATTEMPT_NOT_FOUND");
    if (attempt.user_id !== session.user.id) throw new ApiError(403, "Forbidden", "FORBIDDEN");
    if (attempt.status !== "in_progress") throw new ApiError(409, "This attempt is already closed", "ATTEMPT_CLOSED");
    const { data: papers, error: paperError } = await admin
      .from("test_attempt_papers")
      .select("question_id, question_snapshot")
      .eq("attempt_id", attemptId);
    if (paperError) throw paperError;
    if (!papers?.length) throw new ApiError(409, "This attempt has no frozen question paper.", "PAPER_NOT_FOUND");
    if (new Set(responses.map((response) => response.question_id)).size !== responses.length) {
      throw new ApiError(400, "Responses must not contain duplicate questions.", "DUPLICATE_QUESTION");
    }

    const paperById = new Map(papers.map((paper) => [paper.question_id, paper]));
    for (const response of responses) {
      const paper = paperById.get(response.question_id);
      if (!paper) throw new ApiError(400, "A response contains a question outside this attempt.", "INVALID_QUESTION");
      const snapshot = paper.question_snapshot as { options?: Array<{ id?: string }> };
      const optionIds = new Set((snapshot.options ?? []).map((option) => option.id).filter(Boolean));
      if ((response.selected_option_ids ?? []).some((optionId) => !optionIds.has(optionId))) {
        throw new ApiError(400, "A response contains an option outside this question.", "INVALID_OPTION");
      }
    }

    const metadata = attempt.metadata as { paper_settings?: { duration_minutes?: number } } | null;
    let durationMinutes = metadata?.paper_settings?.duration_minutes;
    if (!durationMinutes) {
      const { data: mockTest, error: testError } = await admin
        .from("mock_tests")
        .select("duration_minutes")
        .eq("id", attempt.mock_test_id)
        .maybeSingle();
      if (testError) throw testError;
      if (!mockTest) throw new ApiError(404, "Mock test not found", "TEST_NOT_FOUND");
      durationMinutes = mockTest.duration_minutes;
    }
    const deadline = new Date(attempt.started_at).getTime() + Number(durationMinutes) * 60 * 1000;
    if (!Number.isFinite(deadline) || Date.now() >= deadline) {
      throw new ApiError(409, "This attempt has reached its time limit", "ATTEMPT_EXPIRED");
    }

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
