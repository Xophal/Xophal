import { NextRequest } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { assertMainAdminEmail, sendAdminApprovalRequest } from "@/lib/admin-approval";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";
import { z } from "zod";

const notifySchema = z.object({ id: z.string().uuid() });

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAdminAuth();
    assertMainAdminEmail(profile.email);
    const { id } = await validateBody(notifySchema, await request.json());
    const admin = createAdminClient();
    const { data: signupRequest, error } = await admin
      .from("admin_signup_requests")
      .select("id, email, full_name, requested_role, status")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!signupRequest) throw new ApiError(404, "Admin signup request not found.", "NOT_FOUND");
    if (signupRequest.status !== "pending") throw new ApiError(409, "This request has already been reviewed.", "ALREADY_REVIEWED");

    await sendAdminApprovalRequest({ email: signupRequest.email, fullName: signupRequest.full_name, requestedRole: signupRequest.requested_role });
    return apiSuccess({ sent: true });
  } catch (error) {
    return handleApiError(error);
  }
}