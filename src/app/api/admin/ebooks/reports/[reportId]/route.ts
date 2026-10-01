import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAdminRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ reportId: string }> };

const updateSchema = z.object({
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"]),
  adminNote: z.string().trim().max(2000).optional(),
});

/** Moves a report through the review workflow and stamps the reviewer. */
export async function PATCH(request: NextRequest, context: Context) {
  try {
    assertTrustedOrigin(request);
    const session = await requireAdminRole(["super_admin", "admin", "content_manager", "reviewer"]);
    const input = await validateBody(updateSchema, await request.json());
    const { reportId } = await context.params;

    const { data, error } = await createAdminClient()
      .from("ebook_reports")
      .update({
        status: input.status,
        admin_note: input.adminNote ?? null,
        reviewed_by: session.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", reportId)
      .select("id, status")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "Report not found.", "NOT_FOUND");
    return apiSuccess({ report: data });
  } catch (error) {
    return handleApiError(error);
  }
}