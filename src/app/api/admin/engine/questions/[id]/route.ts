import { NextRequest } from "next/server";
import { normalizeRoleCode, requireAdminAuth, requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { engineStatusTransitionSchema, updateEngineQuestionSchema } from "@/lib/engine/question-schema";
import {
  archiveEngineQuestion,
  getEngineQuestion,
  transitionEngineQuestion,
  updateEngineQuestion,
} from "@/lib/engine/question-service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    await requireAdminRole(["super_admin", "admin", "content_manager", "reviewer"]);
    const { id } = await params;
    const admin = createAdminClient();
    return apiSuccess(await getEngineQuestion(admin, id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const payload = await validateBody(updateEngineQuestionSchema, await request.json());
    const admin = createAdminClient();
    return apiSuccess(await updateEngineQuestion(admin, id, payload));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  try {
    await requireAdminAuth();
    const { id } = await params;
    const admin = createAdminClient();
    return apiSuccess(await archiveEngineQuestion(admin, id));
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/admin/engine/questions/:id — review-queue status transition. */
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { user, profile } = await requireAdminRole(["super_admin", "admin", "content_manager", "reviewer"]);
    const { id } = await params;
    const payload = await validateBody(engineStatusTransitionSchema, await request.json());
    const admin = createAdminClient();
    return apiSuccess(
      await transitionEngineQuestion(
        admin,
        id,
        payload.status,
        user.id,
        payload.reviewNotes ?? "",
        normalizeRoleCode(profile) === "reviewer"
      )
    );
  } catch (error) {
    return handleApiError(error);
  }
}
