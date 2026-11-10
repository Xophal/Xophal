import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const updateSchema = z.object({
  title: z.string().min(2).max(500).optional(),
  slug: z.string().min(2).max(500).optional(),
  description: z.string().optional().or(z.literal("")),
  duration_minutes: z.number().int().positive().optional(),
  access_price: z.number().min(0).finite().optional(),
  passing_marks: z.number().optional(),
  is_premium: z.boolean().optional(),
  is_published: z.boolean().optional(),
  is_active: z.boolean().optional(),
  instructions: z.string().optional().or(z.literal("")),
});

type Params = { params: Promise<{ mockTestId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireAdminRole(["super_admin", "admin", "content_manager"]);
    const { mockTestId } = await params;
    const payload = await validateBody(updateSchema, await request.json());
    const admin = createAdminClient();
    if (payload.is_published === true) {
      const { data: test, error: testError } = await admin
        .from("mock_tests")
        .select("id,is_active,total_questions,duration_minutes")
        .eq("id", mockTestId)
        .maybeSingle();
      if (testError) throw testError;
      if (!test) throw new ApiError(404, "Mock test not found", "NOT_FOUND");
      if (!test.is_active || test.duration_minutes <= 0) {
        throw new ApiError(409, "An active test with a positive duration is required before publishing.", "INVALID_TEST");
      }

      const { count, error: questionError } = await admin
        .from("mock_test_questions")
        .select("question_id,questions!inner(id)", { count: "exact", head: true })
        .eq("mock_test_id", mockTestId)
        .eq("questions.status", "published")
        .eq("questions.is_active", true);
      if (questionError) throw questionError;
      if (!count || count !== test.total_questions) {
        throw new ApiError(
          409,
          "The test must contain active, published questions matching its displayed total before it can be published.",
          "INVALID_QUESTION_SELECTION"
        );
      }
    }
    const { data, error } = await admin.from("mock_tests").update({
      ...payload,
      ...(payload.instructions !== undefined ? { instructions: payload.instructions || null } : {}),
      published_at: payload.is_published === true ? new Date().toISOString() : payload.is_published === false ? null : undefined,
    }).eq("id", mockTestId).select().maybeSingle();
    if (error?.code === "23514" && payload.is_published === true) {
      throw new ApiError(
        409,
        "The mock test changed while it was being published. Refresh it and verify all questions and totals.",
        "TEST_PUBLISH_REJECTED"
      );
    }
    if (error?.code === "23505") {
      throw new ApiError(409, "A mock test with this slug already exists.", "DUPLICATE_SLUG");
    }
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