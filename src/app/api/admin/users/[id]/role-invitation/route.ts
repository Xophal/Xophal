import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAdminAuth } from "@/lib/auth";
import { isMainAdminEmail } from "@/lib/admin-approval";
import { createRoleInvitationToken, getRoleInvitationExpiry, sendRoleInvitationEmail } from "@/lib/user-management-email";
import { normalizeRoleCode } from "@/lib/roles";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const createInvitationSchema = z.object({
  role: z.string().trim().min(1).max(50),
}).strict();

async function requireSuperAdmin() {
  const session = await requireAdminAuth();
  if (normalizeRoleCode(session.profile) !== "super_admin") {
    throw new ApiError(403, "Only a super administrator can manage user roles.", "FORBIDDEN");
  }
  return session;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    await checkRateLimit(request);
    const session = await requireSuperAdmin();
    const { id } = await params;
    const payload = await validateBody(createInvitationSchema, await request.json());
    const admin = createAdminClient();

    const [{ data: target, error: targetError }, { data: role, error: roleError }] = await Promise.all([
      admin.from("profiles")
        .select("id, email, full_name, roles(code)")
        .eq("id", id)
        .maybeSingle(),
      admin.from("roles")
        .select("id, code, name")
        .eq("code", payload.role)
        .maybeSingle(),
    ]);
    if (targetError) throw targetError;
    if (roleError) throw roleError;
    if (!target) throw new ApiError(404, "User account not found.", "USER_NOT_FOUND");
    if (!role) throw new ApiError(404, "That role is not available.", "ROLE_NOT_FOUND");
    if (role.code === "super_admin") {
      throw new ApiError(403, "Super administrator access cannot be granted through a role invitation.", "PROTECTED_ROLE");
    }
    if (!target.email?.trim()) {
      throw new ApiError(422, "This account has no email address to invite.", "USER_EMAIL_REQUIRED");
    }
    if (isMainAdminEmail(target.email)) {
      throw new ApiError(409, "The configured super administrator account cannot be changed here.", "PROTECTED_ADMIN_ACCOUNT");
    }
    const currentRole = Array.isArray(target.roles) ? target.roles[0] : target.roles;
    if (currentRole?.code === role.code) {
      throw new ApiError(409, "This user already has that role.", "ROLE_ALREADY_ASSIGNED");
    }

    const { error: cancelError } = await admin
      .from("user_role_invitations")
      .update({ status: "CANCELLED", responded_at: new Date().toISOString() })
      .eq("user_id", id)
      .eq("status", "PENDING");
    if (cancelError) throw cancelError;

    const { token, tokenHash } = createRoleInvitationToken();
    const expiresAt = getRoleInvitationExpiry();
    const { data: invitation, error: insertError } = await admin
      .from("user_role_invitations")
      .insert({
        user_id: id,
        requested_role_id: role.id,
        requested_by: session.user.id,
        email: target.email,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    try {
      await sendRoleInvitationEmail({
        email: target.email,
        fullName: target.full_name,
        roleName: role.name,
        token,
      });
    } catch (error) {
      const { error: cancelInvitationError } = await admin
        .from("user_role_invitations")
        .update({ status: "EMAIL_FAILED", responded_at: new Date().toISOString() })
        .eq("id", invitation.id)
        .eq("status", "PENDING");
      if (cancelInvitationError) {
        console.error("Could not close role invitation after email delivery failed", {
          invitationId: invitation.id,
          error: cancelInvitationError,
        });
      }
      throw error;
    }

    return apiSuccess({
      invitation: {
        id: invitation.id,
        role: { code: role.code, name: role.name },
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
      emailSent: true,
    }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const session = await requireSuperAdmin();
    const { id } = await params;
    const admin = createAdminClient();
    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("id, email")
      .eq("id", id)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) throw new ApiError(404, "User account not found.", "USER_NOT_FOUND");
    if (isMainAdminEmail(target.email)) {
      throw new ApiError(409, "The configured super administrator account cannot be changed here.", "PROTECTED_ADMIN_ACCOUNT");
    }

    const { data, error } = await admin
      .from("user_role_invitations")
      .update({ status: "CANCELLED", responded_at: new Date().toISOString() })
      .eq("user_id", id)
      .eq("status", "PENDING")
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "There is no pending role invitation to cancel.", "INVITATION_NOT_FOUND");
    console.info("Super administrator cancelled a pending role invitation", {
      actorId: session.user.id,
      targetUserId: id,
      invitationId: data.id,
    });
    return apiSuccess({ cancelled: true });
  } catch (error) {
    return handleApiError(error);
  }
}
