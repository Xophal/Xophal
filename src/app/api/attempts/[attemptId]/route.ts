import { NextRequest } from "next/server";

import { ApiError, apiSuccess, handleApiError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAttemptState } from "@/lib/engine/attempt-service";

/**
 * GET /api/attempts/:attemptId
 * Status, deadline and progress for the timer. Never returns answer data.
 */

type Ctx = { params: Promise<{ attemptId: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    const session = await requireAuth();
    if (!session) throw new ApiError(401, "Authentication required", "UNAUTHORIZED");

    const { attemptId } = await params;
    const admin = createAdminClient();
    const attempt = await getAttemptState(admin, attemptId, session.user.id);
    return apiSuccess({ attempt });
  } catch (error) {
    return handleApiError(error);
  }
}
