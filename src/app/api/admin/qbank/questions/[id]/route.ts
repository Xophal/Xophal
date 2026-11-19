import { NextRequest } from "next/server";
import { normalizeRoleCode, requireAdminAuth, requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { z } from "zod";
import { getQuestion, updateQuestion, archiveOrDeleteQuestion, transitionReviewStatus } from "@/lib/qbank/question-service";
import { CreateQuestionSchema, ReviewQuestionSchema } from "@/lib/qbank/validation";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminAuth();
    const admin = createAdminClient();
    const { id } = await context.params;
    const question = await getQuestion(admin, id);
    return apiSuccess({ question });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, profile } = await requireAdminAuth();
    const body = await validateBody(
      CreateQuestionSchema.partial().extend({ change_reason: z.string().optional() }),
      await request.json()
    );
    if (["approved", "published"].includes(body.status ?? "") && !["admin", "super_admin"].includes(normalizeRoleCode(profile) ?? "")) {
      throw new ApiError(403, "Only administrators can approve questions.", "FORBIDDEN");
    }
    const admin = createAdminClient();
    const { id } = await context.params;
    const question = await updateQuestion(admin, id, user.id, body);
    return apiSuccess({ question });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminRole(["admin", "super_admin"]);
    const admin = createAdminClient();
    const { id } = await context.params;
    const result = await archiveOrDeleteQuestion(admin, id);
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAdminAuth();
    const body = await validateBody(ReviewQuestionSchema, await request.json());
    const admin = createAdminClient();
    const { id } = await context.params;
    const status = body.action === "approve" ? "approved" : body.action === "reject" ? "rejected" : "archived";
    const question = await transitionReviewStatus(
      admin,
      id,
      status,
      user.id,
      body.review_notes
    );
    return apiSuccess({ question });
  } catch (error) {
    return handleApiError(error);
  }
}
