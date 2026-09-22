import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth";
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
    await requireAdminAuth();
    const { mockTestId } = await params;
    const admin = createAdminClient();
    const { data, error } = await admin.from("mock_test_sections").select("*").eq("mock_test_id", mockTestId).order("sort_order");
    if (error) throw error;
    return apiSuccess(data ?? []);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    await requireAdminAuth();
    const { mockTestId } = await params;
    const payload = await validateBody(sectionSchema, await request.json());
    const admin = createAdminClient();
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
    await requireAdminAuth();
    const { mockTestId } = await params;
    const sectionId = new URL(request.url).searchParams.get("sectionId");
    if (!sectionId) throw new ApiError(400, "sectionId is required", "MISSING_SECTION_ID");
    const admin = createAdminClient();
    const { data, error } = await admin.from("mock_test_sections").delete().eq("id", sectionId).eq("mock_test_id", mockTestId).select().maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Section not found", "NOT_FOUND");
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
