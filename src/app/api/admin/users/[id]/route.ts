import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiSuccess, assertTrustedOrigin, handleApiError, validateBody } from "@/lib/api-utils";
import { requireAdminAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeRoleCode } from "@/lib/roles";
import { isMainAdminEmail } from "@/lib/admin-approval";
import { sendAccountStatusEmail } from "@/lib/user-management-email";

const patchSchema = z.object({
  isActive: z.boolean(),
}).strict();

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile: adminProfile } = await requireAdminAuth();
    const { id } = await params;
    const admin = createAdminClient();
    const { data, error } = await admin.from("profiles").select("*, roles(code, name)").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return apiSuccess({ profile: null, attemptsCount: 0, canManageAccounts: false, pendingRoleInvitation: null });

    const { error: expireError } = await admin
      .from("user_role_invitations")
      .update({ status: "EXPIRED", responded_at: new Date().toISOString() })
      .eq("user_id", id)
      .eq("status", "PENDING")
      .lte("expires_at", new Date().toISOString());
    if (expireError) throw expireError;

    const [{ count, error: attemptsError }, { data: invitation, error: invitationError }] = await Promise.all([
      admin.from("test_attempts").select("id", { count: "exact", head: true }).eq("user_id", id),
      admin.from("user_role_invitations")
        .select("id, requested_role_id, created_at, expires_at")
        .eq("user_id", id)
        .eq("status", "PENDING")
        .maybeSingle(),
    ]);
    if (attemptsError) throw attemptsError;
    if (invitationError) throw invitationError;

    let pendingRoleInvitation = null;
    if (invitation) {
      const { data: requestedRole, error: roleError } = await admin.from("roles")
        .select("code, name")
        .eq("id", invitation.requested_role_id)
        .maybeSingle();
      if (roleError) throw roleError;
      if (requestedRole) {
        pendingRoleInvitation = {
          id: invitation.id,
          role: requestedRole,
          created_at: invitation.created_at,
          expires_at: invitation.expires_at,
        };
      }
    }

    return apiSuccess({
      profile: data,
      attemptsCount: count ?? 0,
      canManageAccounts:
        normalizeRoleCode(adminProfile) === "super_admin" &&
        normalizeRoleCode(data.roles) !== "super_admin" &&
        !isMainAdminEmail(data.email),
      pendingRoleInvitation,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const { profile: adminProfile } = await requireAdminAuth();
    if (normalizeRoleCode(adminProfile) !== "super_admin") {
      throw new ApiError(403, "Only a super administrator can change account status.", "FORBIDDEN");
    }
    const { id } = await params;
    const body = await request.json();
    const payload = await validateBody(patchSchema, body);
    const admin = createAdminClient();
    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("id, email, full_name, is_active, roles(code)")
      .eq("id", id)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) throw new ApiError(404, "User account not found.", "USER_NOT_FOUND");
    const targetRole = Array.isArray(target.roles) ? target.roles[0] : target.roles;
    if (targetRole?.code === "super_admin" || isMainAdminEmail(target.email)) {
      throw new ApiError(409, "The configured super administrator account cannot be deactivated here.", "PROTECTED_ADMIN_ACCOUNT");
    }
    if (!target.email?.trim()) {
      throw new ApiError(422, "This account has no email address for a status notification.", "USER_EMAIL_REQUIRED");
    }
    if (target.is_active === payload.isActive) {
      return apiSuccess({ profile: target, notificationSent: false, unchanged: true });
    }

    const { error: updateError } = await admin
      .from("profiles")
      .update({ is_active: payload.isActive })
      .eq("id", id);
    if (updateError) throw updateError;

    try {
      await sendAccountStatusEmail({
        email: target.email,
        fullName: target.full_name,
        isActive: payload.isActive,
      });
    } catch (error) {
      console.error("Account status changed but its email notification failed", { userId: id, error });
      const message = error instanceof ApiError
        ? `Account status was changed, but the email could not be delivered: ${error.message}`
        : "Account status was changed, but the email could not be delivered. Please try again.";
      throw new ApiError(error instanceof ApiError ? error.statusCode : 502, message, "ACCOUNT_STATUS_EMAIL_FAILED");
    }

    const { data, error } = await admin.from("profiles").select("*, roles(code, name)").eq("id", id).maybeSingle();
    if (error) throw error;
    return apiSuccess({ profile: data, notificationSent: true });
  } catch (error) {
    return handleApiError(error);
  }
}
