import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/api-utils";
import type { Profile } from "@/types";
import { isAdminRole } from "@/lib/roles";
import { isMainAdminEmail } from "@/lib/admin-approval";
import type { User } from "@supabase/supabase-js";

export { normalizeRoleCode, isAdminRole, isStudentRole } from "@/lib/roles";

export function buildProfileUpsertPayload(
  userId: string,
  input: {
    fullName: string;
    email: string;
    phone?: string | null;
    boardId?: string | null;
    classId?: string | null;
    roleId?: string | null;
    emailVerified?: boolean;
  }
) {
  return {
    id: userId,
    email: input.email,
    full_name: input.fullName,
    phone: input.phone || null,
    board_id: input.boardId || null,
    class_id: input.classId || null,
    role_id: input.roleId || null,
    email_verified: input.emailVerified ?? false,
  };
}

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email_confirmed_at ? user : null;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*, roles(code, name)")
    .eq("id", userId)
    .single();
  return data;
}

export async function ensureProfile(user: User): Promise<Profile | null> {
  const profile = await getProfile(user.id);
  if (profile) return profile;

  const adminClient = createAdminClient();
  // A configured main administrator must be provisioned with the highest role
  // even when the profile was created lazily here (e.g. via Google/OAuth).
  const isMainAdmin = isMainAdminEmail(user.email ?? "");
  const { data: roleRows } = await adminClient
    .from("roles")
    .select("id, code")
    .in("code", isMainAdmin ? ["super_admin"] : ["student"]);
  const roleId = (roleRows ?? [])[0]?.id ?? null;

  const { error } = await adminClient.from("profiles").upsert({
    id: user.id,
    email: user.email ?? "",
    full_name: typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : (user.email?.split("@")[0] ?? "Student"),
    role_id: roleId,
    email_verified: Boolean(user.email_confirmed_at),
  }, { onConflict: "id" });

  if (error) {
    console.error("Failed to repair missing user profile", error);
    return null;
  }

  return getProfile(user.id);
}

/**
 * Ensures a configured main administrator (MAIN_ADMIN_EMAILS) is raised to the
 * `super_admin` role. It is a no-op (and performs no database work) for anyone
 * who is not a main admin or who is already privileged. Re-querying the profile
 * afterwards is recommended, but a synthesised/admin-shaped profile is returned
 * so role-gating callers (e.g. OTP verify, OAuth callback) can act immediately.
 */
export async function promoteMainAdminProfile(input: {
  userId: string;
  email: string | null | undefined;
  profile: Profile | null;
}): Promise<Profile | null> {
  const email = input.email?.trim().toLowerCase() ?? "";
  if (!email || !isMainAdminEmail(email)) return input.profile;
  if (isAdminRole(input.profile)) return input.profile;

  const adminClient = createAdminClient();
  const { data: superAdminRole } = await adminClient
    .from("roles")
    .select("id, code, name")
    .eq("code", "super_admin")
    .maybeSingle();
  if (!superAdminRole?.id) return input.profile;

  const { error } = await adminClient
    .from("profiles")
    .update({ role_id: superAdminRole.id })
    .eq("id", input.userId);
  if (error) {
    console.error("Failed to promote main administrator profile", error);
    return input.profile;
  }

  const role = { code: "super_admin", name: superAdminRole.name ?? "Super Admin" };
  if (!input.profile) {
    return {
      id: input.userId,
      email,
      full_name: email.split("@")[0],
      avatar_url: null,
      phone: null,
      is_premium: false,
      premium_expires_at: null,
      email_verified: true,
      daily_goal_minutes: 0,
      current_streak: 0,
      longest_streak: 0,
      total_xp: 0,
      level: 1,
      board_id: null,
      class_id: null,
      role_id: superAdminRole.id,
      roles: [role],
    } as Profile;
  }

  return {
    ...input.profile,
    role_id: superAdminRole.id,
    roles: [role] as Profile["roles"],
  };
}

export async function getProfileWithRole(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*, roles(code, name)")
    .eq("id", userId)
    .single();
  return data;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const profile = await getProfileWithRole(userId);
  return isAdminRole(profile);
}

export async function requireAuth() {
  const user = await getSessionUser();
  if (!user) return null;
  const profile = await ensureProfile(user);
  if (profile && profile.is_active === false) {
    throw new ApiError(403, "Account deactivated", "ACCOUNT_DEACTIVATED");
  }
  return { user, profile };
}

export async function requireAdminAuth() {
  const user = await getSessionUser();
  if (!user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const profile = await getProfileWithRole(user.id);
  if (!profile || profile.is_active === false) {
    throw new ApiError(403, "Account deactivated", "ACCOUNT_DEACTIVATED");
  }

  if (!isAdminRole(profile)) {
    throw new ApiError(403, "Forbidden", "FORBIDDEN");
  }

  return { user, profile };
}
