import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashRoleInvitationToken } from "@/lib/user-management-email";

const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/i, "This invitation link is invalid.");
const responseSchema = z.object({
  token: tokenSchema,
  decision: z.enum(["accept", "reject"]),
}).strict();

export async function GET(request: NextRequest) {
  try {
    await checkRateLimit(request);
    const tokenResult = tokenSchema.safeParse(request.nextUrl.searchParams.get("token") ?? "");
    if (!tokenResult.success) throw new ApiError(400, "This invitation link is invalid.", "INVITATION_INVALID");
    const token = tokenResult.data;
    const admin = createAdminClient();
    const { data: invitation, error } = await admin
      .from("user_role_invitations")
      .select("status, expires_at, requested_role_id, user_id, email")
      .eq("token_hash", hashRoleInvitationToken(token))
      .maybeSingle();
    if (error) throw error;
    if (!invitation) throw new ApiError(404, "This invitation link is invalid.", "INVITATION_NOT_FOUND");
    if (invitation.status === "PENDING" && new Date(invitation.expires_at) <= new Date()) {
      const { error: expireError } = await admin
        .from("user_role_invitations")
        .update({ status: "EXPIRED", responded_at: new Date().toISOString() })
        .eq("token_hash", hashRoleInvitationToken(token))
        .eq("status", "PENDING");
      if (expireError) throw expireError;
      invitation.status = "EXPIRED";
    }
    if (invitation.status === "PENDING") {
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("email")
        .eq("id", invitation.user_id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile || profile.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase()) {
        const { error: cancelError } = await admin
          .from("user_role_invitations")
          .update({ status: "CANCELLED", responded_at: new Date().toISOString() })
          .eq("token_hash", hashRoleInvitationToken(token))
          .eq("status", "PENDING");
        if (cancelError) throw cancelError;
        invitation.status = "CANCELLED";
      }
    }

    const { data: role, error: roleError } = await admin
      .from("roles")
      .select("name")
      .eq("id", invitation.requested_role_id)
      .maybeSingle();
    if (roleError) throw roleError;
    return apiSuccess({
      status: invitation.status,
      roleName: role?.name ?? null,
      expiresAt: invitation.expires_at,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    await checkRateLimit(request);
    const payload = await validateBody(responseSchema, await request.json());
    const { data, error } = await createAdminClient().rpc("respond_to_user_role_invitation", {
      p_token_hash: hashRoleInvitationToken(payload.token),
      p_decision: payload.decision.toUpperCase(),
    });
    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    if (!result || result.result === "NOT_FOUND") {
      throw new ApiError(404, "This invitation link is invalid.", "INVITATION_NOT_FOUND");
    }
    if (result.result === "EXPIRED") {
      throw new ApiError(410, "This role invitation has expired.", "INVITATION_EXPIRED");
    }
    if (result.result === "EMAIL_CHANGED") {
      throw new ApiError(410, "This invitation was cancelled because the account email address changed.", "INVITATION_EMAIL_CHANGED");
    }
    const expectedResult = payload.decision === "accept" ? "ACCEPTED" : "REJECTED";
    if (result.result !== expectedResult) {
      throw new ApiError(409, "This role invitation has already been responded to or cancelled.", "INVITATION_ALREADY_RESOLVED");
    }

    return apiSuccess({
      status: result.result,
      roleName: result.role_name,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
