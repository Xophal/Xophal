import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminRole } from "@/lib/auth";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ categoryId: string }> }) {
  try {
    assertTrustedOrigin(request);
    await requireAdminRole(["super_admin", "admin", "content_manager"]);
    const { categoryId } = await params;
    const input = await validateBody(z.object({ name: z.string().trim().min(2).max(120).optional(), description: z.string().trim().max(1000).optional(), is_active: z.boolean().optional() }), await request.json());
    const { data, error } = await createAdminClient().from("ebook_categories").update(input).eq("id", categoryId).select().maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Category not found.", "NOT_FOUND");
    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}