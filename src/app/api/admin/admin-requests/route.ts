import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth";
import { assertMainAdminEmail } from "@/lib/admin-approval";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, apiSuccess, handleApiError, validateBody } from "@/lib/api-utils";

const decisionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
});

export async function GET() {
  try {
    const { profile } = await requireAdminAuth();
    assertMainAdminEmail(profile.email);
    const { data, error } = await createAdminClient()
      .from("admin_signup_requests")
      .select("id, user_id, email, full_name, phone, requested_role, status, created_at, reviewed_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return apiSuccess(data ?? []);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, profile } = await requireAdminAuth();
    assertMainAdminEmail(profile.email);
    const payload = await validateBody(decisionSchema, await request.json());
    const adminClient = createAdminClient();

    const { data: signupRequest, error: requestError } = await adminClient
      .from("admin_signup_requests")
      .select("id, user_id, requested_role, status")
      .eq("id", payload.id)
      .maybeSingle();

    if (requestError) throw requestError;
    if (!signupRequest) throw new ApiError(404, "Admin signup request not found.", "NOT_FOUND");
    if (signupRequest.status !== "pending") throw new ApiError(409, "This request has already been reviewed.", "ALREADY_REVIEWED");

    if (payload.action === "approve") {
      const { data: roleRow, error: roleError } = await adminClient
        .from("roles")
        .select("id")
        .eq("code", signupRequest.requested_role)
        .maybeSingle();
      if (roleError) throw roleError;
      if (!roleRow) throw new ApiError(400, "The requested admin role is unavailable.", "ROLE_NOT_FOUND");

      const { error: profileError } = await adminClient
        .from("profiles")
        .update({ role_id: roleRow.id, is_active: true })
        .eq("id", signupRequest.user_id);
      if (profileError) throw profileError;
    }

    const { error: updateError } = await adminClient
      .from("admin_signup_requests")
      .update({ status: payload.action === "approve" ? "approved" : "rejected", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq("id", payload.id);
    if (updateError) throw updateError;

    return apiSuccess({ status: payload.action === "approve" ? "approved" : "rejected" });
  } catch (error) {
    return handleApiError(error);
  }
}