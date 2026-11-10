import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const sectionSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional().or(z.literal("")),
  duration_minutes: z.number().int().positive().optional().nullable(),
  sort_order: z.number().int().min(0).optional().default(0),
});

type Params = { params: Promise<{ mockTestId: string }> };

export async function GET(_: NextRequest, { params }: Params) {
  try {
    await requireAdminRole(["super_admin", "admin", "content_manager"]);
    const { mockTestId } = await params;
    if (!z.string().uuid().safeParse(mockTestId).success) throw new ApiError(400, "A valid mock test ID is required.", "INVALID_TEST_ID");
    const admin = createAdminClient();
    const { data: test, error: testError } = await admin.from("mock_tests").select("id").eq("id", mockTestId).maybeSingle();
    if (testError) throw testError;
    if (!test) throw new ApiError(404, "Mock test not found.", "NOT_FOUND");
    const { data, error } = await admin.from("mock_test_sections").select("*").eq("mock_test_id", mockTestId).order("sort_order");
    if (error) throw error;
    return apiSuccess(data ?? []);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    await requireAdminRole(["super_admin", "admin", "content_manager"]);
    const { mockTestId } = await params;
    if (!z.string().uuid().safeParse(mockTestId).success) throw new ApiError(400, "A valid mock test ID is required.", "INVALID_TEST_ID");
    const payload = await validateBody(sectionSchema, await request.json());
    const admin = createAdminClient();
    const { data: test, error: testError } = await admin.from("mock_tests").select("id").eq("id", mockTestId).maybeSingle();
    if (testError) throw testError;
    if (!test) throw new ApiError(404, "Mock test not found.", "NOT_FOUND");
    const { data, error } = await admin.from("mock_test_sections").insert([{
      mock_test_id: mockTestId,
      name: payload.name,
      description: payload.description || null,
      duration_minutes: payload.duration_minutes ?? null,
      sort_order: payload.sort_order,
    }]).select().single();
    if (error) throw error;
    return apiSuccess(data, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    await requireAdminRole(["super_admin", "admin", "content_manager"]);
    const { mockTestId } = await params;
    if (!z.string().uuid().safeParse(mockTestId).success) throw new ApiError(400, "A valid mock test ID is required.", "INVALID_TEST_ID");
    const sectionId = new URL(request.url).searchParams.get("sectionId");
    if (!sectionId || !z.string().uuid().safeParse(sectionId).success) throw new ApiError(400, "A valid sectionId is required.", "INVALID_SECTION_ID");
    const admin = createAdminClient();
    const { data: test, error: testError } = await admin.from("mock_tests").select("id, is_published").eq("id", mockTestId).maybeSingle();
    if (testError) throw testError;
    if (!test) throw new ApiError(404, "Mock test not found.", "NOT_FOUND");
    const { data: section, error: sectionError } = await admin
      .from("mock_test_sections")
      .select("id")
      .eq("id", sectionId)
      .eq("mock_test_id", mockTestId)
      .maybeSingle();
    if (sectionError) throw sectionError;
    if (!section) throw new ApiError(404, "Section not found.", "NOT_FOUND");
    const { data: activeAttempts, error: attemptsError } = await admin
      .from("test_attempts")
      .select("id")
      .eq("mock_test_id", mockTestId)
      .eq("status", "in_progress")
      .limit(1);
    if (attemptsError) throw attemptsError;
    if (activeAttempts?.length) {
      throw new ApiError(409, "Sections cannot be changed while students have an in-progress attempt.", "TEST_HAS_ACTIVE_ATTEMPTS");
    }
    if (test.is_published) {
      const { error: unpublishError } = await admin
        .from("mock_tests")
        .update({ is_published: false, published_at: null })
        .eq("id", mockTestId);
      if (unpublishError) throw unpublishError;
    }
    const { data, error } = await admin.from("mock_test_sections").delete().eq("id", sectionId).eq("mock_test_id", mockTestId).select().maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Section not found", "NOT_FOUND");
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
