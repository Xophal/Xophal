import { NextRequest } from "next/server";
import { normalizeRoleCode, requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { QuestionListQuerySchema, CreateQuestionSchema } from "@/lib/qbank/validation";
import { listQuestions, createQuestion } from "@/lib/qbank/question-service";

export async function GET(request: NextRequest) {
  try {
    await requireAdminAuth();
    const query = QuestionListQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const admin = createAdminClient();
    const result = await listQuestions(admin, query);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, profile } = await requireAdminAuth();
    const body = await validateBody(CreateQuestionSchema, await request.json());
    if (["approved", "published"].includes(body.status) && !["admin", "super_admin"].includes(normalizeRoleCode(profile) ?? "")) {
      throw new ApiError(403, "Only administrators can create approved questions.", "FORBIDDEN");
    }
    const admin = createAdminClient();
    const question = await createQuestion(admin, user.id, body);
    return apiSuccess({ question }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}