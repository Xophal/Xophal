import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUsableMockTestQuestion } from "@/lib/mock-tests/question-readiness";
import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const updateSchema = z.object({
  title: z.string().min(2).max(500).optional(),
  slug: z.string().min(2).max(500).optional(),
  description: z.string().max(10000).optional().or(z.literal("")),
  duration_minutes: z.number().int().positive().optional(),
  access_price: z.number().min(0).finite().optional(),
  passing_marks: z.number().min(0).finite().optional(),
  negative_marking: z.boolean().optional(),
  negative_marks_ratio: z.number().min(0).max(1).optional(),
  shuffle_questions: z.boolean().optional(),
  shuffle_options: z.boolean().optional(),
  show_solutions: z.boolean().optional(),
  allow_review: z.boolean().optional(),
  max_attempts: z.number().int().min(0).optional(),
  is_premium: z.boolean().optional(),
  is_published: z.boolean().optional(),
  is_active: z.boolean().optional(),
  instructions: z.string().max(10000).optional().or(z.literal("")),
});

type Params = { params: Promise<{ mockTestId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireAdminRole(["super_admin", "admin", "content_manager"]);
    const { mockTestId } = await params;
    if (!z.string().uuid().safeParse(mockTestId).success) {
      throw new ApiError(400, "A valid mock test ID is required.", "INVALID_TEST_ID");
    }
    const payload = await validateBody(updateSchema, await request.json());
    const admin = createAdminClient();
    if (payload.is_published === true) {
      const { data: links, error: linksError } = await admin
        .from("mock_test_questions")
        .select("question_id, questions!inner(status, is_active, question_types(code), question_options(id, option_text, is_correct))")
        .eq("mock_test_id", mockTestId);
      if (linksError) throw linksError;
      const linkedQuestions = (links ?? []).flatMap((link) => {
        const questions = link.questions;
        return Array.isArray(questions) ? questions : questions ? [questions] : [];
      });
      if (linkedQuestions.length === 0 || linkedQuestions.some((question) => !isUsableMockTestQuestion(question))) {
        throw new ApiError(
          400,
          "Add at least one active, published multiple-choice question with a valid answer key before publishing.",
          "TEST_NOT_READY"
        );
      }
    }

    const updatePayload = {
      ...payload,
      ...(payload.description !== undefined ? { description: payload.description || null } : {}),
      ...(payload.instructions !== undefined ? { instructions: payload.instructions || null } : {}),
      ...(payload.is_published !== undefined
        ? { published_at: payload.is_published ? new Date().toISOString() : null }
        : {}),
    };
    const { data, error } = await admin.from("mock_tests").update(updatePayload).eq("id", mockTestId).select().maybeSingle();
    if (error?.code === "23505") throw new ApiError(409, "A mock test with this slug already exists.", "DUPLICATE_SLUG");
    if (error) throw error;
    if (!data) throw new ApiError(404, "Mock test not found", "NOT_FOUND");
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    await requireAdminRole(["super_admin", "admin", "content_manager"]);
    const { mockTestId } = await params;
    const admin = createAdminClient();
    const { data, error } = await admin.from("mock_tests").update({ is_active: false, is_published: false }).eq("id", mockTestId).select().maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Mock test not found", "NOT_FOUND");
    return apiSuccess({ archived: true, mockTest: data });
  } catch (error) {
    return handleApiError(error);
  }
}