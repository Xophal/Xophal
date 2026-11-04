import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { createAdminClient } from "@/lib/supabase/admin";

const assignmentSchema = z.object({
  question_id: z.string().uuid(),
  section_id: z.string().uuid().nullable(),
});

type Params = { params: Promise<{ mockTestId: string }> };

export async function GET(_: NextRequest, { params }: Params) {
  try {
    await requireAdminRole(["super_admin", "admin", "content_manager"]);
    const { mockTestId } = await params;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("mock_test_questions")
      .select("question_id, section_id, sort_order, questions(stem, question_text)")
      .eq("mock_test_id", mockTestId)
      .order("sort_order");
    if (error) throw error;
    return apiSuccess(data ?? []);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireAdminRole(["super_admin", "admin", "content_manager"]);
    const { mockTestId } = await params;
    const payload = await validateBody(assignmentSchema, await request.json());
    const admin = createAdminClient();

    if (payload.section_id) {
      const { data: section, error: sectionError } = await admin
        .from("mock_test_sections")
        .select("id")
        .eq("id", payload.section_id)
        .eq("mock_test_id", mockTestId)
        .maybeSingle();
      if (sectionError) throw sectionError;
      if (!section) throw new ApiError(404, "Section not found for this mock test.", "SECTION_NOT_FOUND");
    }

    const { data, error } = await admin
      .from("mock_test_questions")
      .update({ section_id: payload.section_id })
      .eq("mock_test_id", mockTestId)
      .eq("question_id", payload.question_id)
      .select("question_id, section_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Question not found in this mock test.", "QUESTION_NOT_FOUND");
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
