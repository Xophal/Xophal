import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const attachSchema = z.object({
  questionId: z.string().uuid(),
  sectionId: z.string().uuid().optional().nullable(),
  marksOverride: z.number().min(0).max(100).optional(),
});

type Params = { params: Promise<{ mockTestId: string }> };

export async function GET(_: NextRequest, { params }: Params) {
  try {
    await requireAdminRole(["super_admin", "admin", "content_manager"]);
    const { mockTestId } = await params;
    const admin = createAdminClient();
    const { data: test, error: testError } = await admin.from("mock_tests").select("id").eq("id", mockTestId).maybeSingle();
    if (testError) throw testError;
    if (!test) throw new ApiError(404, "Mock test not found", "NOT_FOUND");

    const [{ data: links, error: linksError }, { data: available, error: availableError }] = await Promise.all([
      admin
        .from("mock_test_questions")
        .select("question_id, sort_order, marks_override, section_id, questions(id, question_text, engine_type, status, marks, topic_id)")
        .eq("mock_test_id", mockTestId)
        .order("sort_order", { ascending: true }),
      admin
        .from("questions")
        .select("id, question_text, engine_type, status, marks, topic_id")
        .eq("is_active", true)
        .eq("status", "published")
        .order("updated_at", { ascending: false })
        .limit(100),
    ]);
    if (linksError) throw linksError;
    if (availableError) throw availableError;

    const attached = (links ?? []).map((link) => ({
      ...link,
      question: Array.isArray(link.questions) ? link.questions[0] ?? null : link.questions,
    }));
    const attachedIds = new Set(attached.map((link) => link.question_id));
    return apiSuccess({
      attached,
      available: (available ?? []).filter((question) => !attachedIds.has(question.id)),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    await requireAdminRole(["super_admin", "admin", "content_manager"]);
    const { mockTestId } = await params;
    const payload = await validateBody(attachSchema, await request.json());
    const admin = createAdminClient();

    const { data: test, error: testError } = await admin.from("mock_tests").select("id").eq("id", mockTestId).maybeSingle();
    if (testError) throw testError;
    if (!test) throw new ApiError(404, "Mock test not found", "NOT_FOUND");

    const { data: question, error: questionError } = await admin
      .from("questions")
      .select("id, marks")
      .eq("id", payload.questionId)
      .eq("is_active", true)
      .eq("status", "published")
      .maybeSingle();
    if (questionError) throw questionError;
    if (!question) throw new ApiError(400, "Only active, published questions can be added.", "QUESTION_NOT_PUBLISHED");

    if (payload.sectionId) {
      const { data: section, error: sectionError } = await admin
        .from("mock_test_sections")
        .select("id")
        .eq("id", payload.sectionId)
        .eq("mock_test_id", mockTestId)
        .maybeSingle();
      if (sectionError) throw sectionError;
      if (!section) throw new ApiError(400, "Section does not belong to this mock test.", "INVALID_SECTION");
    }

    const { data: existing, error: existingError } = await admin
      .from("mock_test_questions")
      .select("question_id")
      .eq("mock_test_id", mockTestId)
      .eq("question_id", payload.questionId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) throw new ApiError(409, "Question is already attached to this test.", "QUESTION_ALREADY_ATTACHED");

    const { data: lastLink, error: orderError } = await admin
      .from("mock_test_questions")
      .select("sort_order")
      .eq("mock_test_id", mockTestId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (orderError) throw orderError;

    const { data, error } = await admin.from("mock_test_questions").insert({
      mock_test_id: mockTestId,
      question_id: payload.questionId,
      section_id: payload.sectionId ?? null,
      sort_order: (lastLink?.sort_order ?? -1) + 1,
      marks_override: payload.marksOverride ?? null,
    }).select().single();
    if (error) throw error;
    return apiSuccess({ ...data, question }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    await requireAdminRole(["super_admin", "admin", "content_manager"]);
    const { mockTestId } = await params;
    const questionId = z.string().uuid().safeParse(request.nextUrl.searchParams.get("questionId"));
    if (!questionId.success) throw new ApiError(400, "A valid questionId is required.", "INVALID_QUESTION_ID");

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("mock_test_questions")
      .delete()
      .eq("mock_test_id", mockTestId)
      .eq("question_id", questionId.data)
      .select("question_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Question is not attached to this test.", "NOT_FOUND");
    return apiSuccess({ detached: true });
  } catch (error) {
    return handleApiError(error);
  }
}