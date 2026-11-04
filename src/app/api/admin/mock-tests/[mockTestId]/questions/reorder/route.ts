import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const reorderSchema = z.object({
  order: z.array(z.object({ questionId: z.string().uuid(), sortOrder: z.number().int().min(0) }))
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ mockTestId: string }> }) {
  try {
    await requireAdminRole(["super_admin", "admin", "content_manager"]);
    const { mockTestId } = await params;
    const body = await request.json();
    const payload = await validateBody(reorderSchema, body);
    const admin = createAdminClient();

    const qIds = payload.order.map((item) => item.questionId);
    const { data: existing, error: existErr } = await admin.from("mock_test_questions").select("question_id").eq("mock_test_id", mockTestId).in("question_id", qIds);
    if (existErr) throw existErr;
    const existingIds = new Set((existing || []).map((row) => row.question_id));
    for (const q of payload.order) {
      if (!existingIds.has(q.questionId)) {
        throw new ApiError(400, "One or more questions do not belong to the specified mock test.", "INVALID_QUESTION_SELECTION");
      }
    }

    for (const item of payload.order) {
      const { error } = await admin.from("mock_test_questions").update({ sort_order: item.sortOrder }).match({ mock_test_id: mockTestId, question_id: item.questionId });
      if (error) throw error;
    }

    return apiSuccess({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
