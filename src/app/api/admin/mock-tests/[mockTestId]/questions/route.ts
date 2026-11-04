import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const questionSelectionSchema = z.object({
  question_ids: z.array(z.string().uuid()).min(1).max(100),
});

type Params = { params: Promise<{ mockTestId: string }> };
type QuestionOption = { id: string; is_correct: boolean };
type QuestionType = { code: string } | { code: string }[] | null;
type QuestionRow = {
  id: string;
  question_text: string;
  status: string;
  is_active: boolean;
  marks: number | string | null;
  question_types: QuestionType;
  question_options: QuestionOption[] | null;
};
type AttachedRow = {
  question_id: string;
  sort_order: number;
  marks_override: number | string | null;
  questions: QuestionRow | QuestionRow[] | null;
};

function isUsableQuestion(question: QuestionRow) {
  const type = Array.isArray(question.question_types)
    ? question.question_types[0]?.code
    : question.question_types?.code;
  const options = question.question_options ?? [];
  const correctCount = options.filter((option) => option.is_correct).length;
  return question.status === "published"
    && question.is_active
    && (type === "single_correct" || type === "multiple_correct")
    && options.length >= 2
    && correctCount >= 1
    && (type === "multiple_correct" || correctCount === 1);
}

async function getTest(admin: ReturnType<typeof createAdminClient>, mockTestId: string) {
  if (!z.string().uuid().safeParse(mockTestId).success) {
    throw new ApiError(400, "A valid mock test ID is required.", "INVALID_TEST_ID");
  }
  const { data: test, error } = await admin
    .from("mock_tests")
    .select("id, is_published")
    .eq("id", mockTestId)
    .maybeSingle();
  if (error) throw error;
  if (!test) throw new ApiError(404, "Mock test not found.", "NOT_FOUND");
  return test;
}

async function unpublishForQuestionChanges(
  admin: ReturnType<typeof createAdminClient>,
  mockTestId: string,
  isPublished: boolean
) {
  const { data: activeAttempts, error: attemptsError } = await admin
    .from("test_attempts")
    .select("id")
    .eq("mock_test_id", mockTestId)
    .eq("status", "in_progress")
    .limit(1);
  if (attemptsError) throw attemptsError;
  if (activeAttempts?.length) {
    throw new ApiError(
      409,
      "Questions cannot be changed while students have an in-progress attempt. Try again after those attempts are submitted.",
      "TEST_HAS_ACTIVE_ATTEMPTS"
    );
  }
  if (!isPublished) return;
  const { error } = await admin
    .from("mock_tests")
    .update({ is_published: false, published_at: null })
    .eq("id", mockTestId);
  if (error) throw error;
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requireAdminRole(["super_admin", "admin", "content_manager"]);
    const { mockTestId } = await params;
    const search = request.nextUrl.searchParams.get("search")?.trim().slice(0, 100) ?? "";
    const admin = createAdminClient();
    await getTest(admin, mockTestId);

    const { data: links, error: linksError } = await admin
      .from("mock_test_questions")
      .select("question_id, sort_order, marks_override, questions(id, question_text, status, is_active, marks, question_types(code), question_options(id, is_correct))")
      .eq("mock_test_id", mockTestId)
      .order("sort_order", { ascending: true });
    if (linksError) throw linksError;

    let availableQuery = admin
      .from("questions")
      .select("id, question_text, status, is_active, marks, question_types(code), question_options(id, is_correct)")
      .eq("status", "published")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(200);
    if (search) availableQuery = availableQuery.ilike("question_text", `%${search}%`);
    const { data: availableRows, error: availableError } = await availableQuery;
    if (availableError) throw availableError;

    const attachedRows = (links ?? []) as AttachedRow[];
    const attachedIds = new Set(attachedRows.map((row) => row.question_id));
    const attachedQuestions = attachedRows.flatMap((row) => {
      const question = Array.isArray(row.questions) ? row.questions[0] : row.questions;
      return question
        ? [{ ...question, sort_order: row.sort_order, marks_override: row.marks_override }]
        : [];
    });
    const availableQuestions = ((availableRows ?? []) as QuestionRow[])
      .filter((question) => !attachedIds.has(question.id) && isUsableQuestion(question))
      .map((question) => ({
        id: question.id,
        question_text: question.question_text,
        marks: question.marks,
        question_type: Array.isArray(question.question_types)
          ? question.question_types[0]?.code ?? null
          : question.question_types?.code ?? null,
      }));

    return apiSuccess({ attachedQuestions, availableQuestions });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    await requireAdminRole(["super_admin", "admin", "content_manager"]);
    const { mockTestId } = await params;
    const payload = await validateBody(questionSelectionSchema, await request.json());
    const admin = createAdminClient();
    const test = await getTest(admin, mockTestId);
    const uniqueQuestionIds = [...new Set(payload.question_ids)];

    const { data: questions, error: questionsError } = await admin
      .from("questions")
      .select("id, question_text, status, is_active, marks, question_types(code), question_options(id, is_correct)")
      .in("id", uniqueQuestionIds);
    if (questionsError) throw questionsError;
    const questionsById = new Map(((questions ?? []) as QuestionRow[]).map((question) => [question.id, question]));
    const invalidQuestion = uniqueQuestionIds.find((id) => {
      const question = questionsById.get(id);
      return !question || !isUsableQuestion(question);
    });
    if (invalidQuestion) {
      throw new ApiError(
        400,
        "Only published, active multiple-choice questions with a valid answer key can be added.",
        "QUESTION_NOT_READY"
      );
    }

    const { data: existingLinks, error: existingLinksError } = await admin
      .from("mock_test_questions")
      .select("question_id")
      .eq("mock_test_id", mockTestId);
    if (existingLinksError) throw existingLinksError;
    const existingIds = new Set((existingLinks ?? []).map((link) => link.question_id));
    const newQuestions = uniqueQuestionIds.filter((id) => !existingIds.has(id));
    if (newQuestions.length === 0) return apiSuccess({ added: 0 });

    await unpublishForQuestionChanges(admin, mockTestId, test.is_published);
    const startOrder = existingLinks?.length ?? 0;
    const { error: insertError } = await admin.from("mock_test_questions").insert(
      newQuestions.map((questionId, index) => ({
        mock_test_id: mockTestId,
        question_id: questionId,
        sort_order: startOrder + index,
      }))
    );
    if (insertError) throw insertError;

    return apiSuccess({ added: newQuestions.length }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    await requireAdminRole(["super_admin", "admin", "content_manager"]);
    const { mockTestId } = await params;
    const questionId = request.nextUrl.searchParams.get("questionId");
    if (!questionId || !z.string().uuid().safeParse(questionId).success) {
      throw new ApiError(400, "A valid questionId is required.", "INVALID_QUESTION_ID");
    }
    const admin = createAdminClient();
    const test = await getTest(admin, mockTestId);

    const { data: existingLink, error: existingLinkError } = await admin
      .from("mock_test_questions")
      .select("question_id")
      .eq("mock_test_id", mockTestId)
      .eq("question_id", questionId)
      .maybeSingle();
    if (existingLinkError) throw existingLinkError;
    if (!existingLink) throw new ApiError(404, "Question is not attached to this test.", "QUESTION_NOT_ATTACHED");

    await unpublishForQuestionChanges(admin, mockTestId, test.is_published);

    const { data, error } = await admin
      .from("mock_test_questions")
      .delete()
      .eq("mock_test_id", mockTestId)
      .eq("question_id", questionId)
      .select("question_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Question is not attached to this test.", "QUESTION_NOT_ATTACHED");

    return apiSuccess({ removed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
