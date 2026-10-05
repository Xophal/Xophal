import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/api-utils";
import type { Profile } from "@/types";
import { isPrivilegedAdminRole, normalizeRoleCode } from "@/lib/roles";
import { isUserEmailVerified } from "@/lib/auth-policy";
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

  if (!user) return null;

  if (isUserEmailVerified(user)) return user;

  const profile = await getProfile(user.id);
  return isUserEmailVerified(user, profile) ? user : null;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*, roles(code, name)")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("Failed to load user profile", error);
    throw new ApiError(503, "Your account profile is temporarily unavailable.", "PROFILE_LOOKUP_FAILED");
  }
  return data;
}

export async function ensureProfile(user: User): Promise<Profile> {
  const profile = await getProfile(user.id);
  if (profile) {
    if (profile.role_id || normalizeRoleCode(profile)) return profile;

    const adminClient = createAdminClient();
    const roleCode = isMainAdminEmail(user.email ?? "") ? "super_admin" : "student";
    const { data: role, error: roleError } = await adminClient
      .from("roles")
      .select("id")
      .eq("code", roleCode)
      .maybeSingle();

    if (roleError) {
      console.error("Failed to load default role for user profile", roleError);
      throw new ApiError(503, "Your account role is temporarily unavailable.", "ROLE_LOOKUP_FAILED");
    }
    if (!role?.id) {
      throw new ApiError(503, "Your account role is not configured.", "ROLE_NOT_CONFIGURED");
    }

    const { error } = await adminClient
      .from("profiles")
      .update({ role_id: role.id })
      .eq("id", user.id);
    if (error) {
      console.error("Failed to repair missing user profile role", error);
      throw new ApiError(503, "Your account profile could not be repaired.", "PROFILE_REPAIR_FAILED");
    }

    const repairedProfile = await getProfile(user.id);
    if (!repairedProfile) {
      throw new ApiError(503, "Your account profile could not be repaired.", "PROFILE_REPAIR_FAILED");
    }
    return repairedProfile;
  }

  const adminClient = createAdminClient();
  // A configured main administrator must be provisioned with the highest role
  // even when the profile was created lazily here (e.g. via Google/OAuth).
  const isMainAdmin = isMainAdminEmail(user.email ?? "");
  const { data: roleRows, error: roleError } = await adminClient
    .from("roles")
    .select("id, code")
    .in("code", isMainAdmin ? ["super_admin"] : ["student"]);
  if (roleError) {
    console.error("Failed to load default role for user profile", roleError);
    throw new ApiError(503, "Your account role is temporarily unavailable.", "ROLE_LOOKUP_FAILED");
  }
  const roleId = (roleRows ?? [])[0]?.id ?? null;
  if (!roleId) {
    throw new ApiError(503, "Your account role is temporarily unavailable.", "ROLE_NOT_CONFIGURED");
  }

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
    throw new ApiError(503, "Your account profile could not be repaired.", "PROFILE_REPAIR_FAILED");
  }

  const createdProfile = await getProfile(user.id);
  if (!createdProfile) {
    throw new ApiError(503, "Your account profile could not be repaired.", "PROFILE_REPAIR_FAILED");
  }
  return createdProfile;
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
  if (isPrivilegedAdminRole(input.profile)) return input.profile;

  const adminClient = createAdminClient();
  const { data: superAdminRole, error: roleError } = await adminClient
    .from("roles")
    .select("id, code, name")
    .eq("code", "super_admin")
    .maybeSingle();
  if (roleError) {
    console.error("Failed to load super administrator role", roleError);
    throw new ApiError(503, "Administrator access is temporarily unavailable.", "ROLE_LOOKUP_FAILED");
  }
  if (!superAdminRole?.id) {
    throw new ApiError(503, "The super administrator role is not configured.", "ROLE_NOT_CONFIGURED");
  }

  const { error } = await adminClient
    .from("profiles")
    .update({ role_id: superAdminRole.id })
    .eq("id", input.userId);
  if (error) {
    console.error("Failed to promote main administrator profile", error);
    throw new ApiError(503, "Administrator access could not be updated.", "ROLE_UPDATE_FAILED");
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
  return getProfile(userId);
}

export async function isAdmin(userId: string): Promise<boolean> {
  const profile = await getProfileWithRole(userId);
  return isPrivilegedAdminRole(profile);
}

function isSupabaseAuthConfigured() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "").trim();
  if (!url || !anonKey) return false;

  try {
    const parsed = new URL(url);
    return parsed.hostname.length > 0 && parsed.protocol.startsWith("http");
  } catch {
    return false;
  }
}

function getDevBypassSession(): { user: User; profile: Profile } | null {
  const enableFlag = process.env.LOCAL_DEV_SKIP_AUTH;
  const isTestRuntime = process.env.NODE_ENV === "test" || process.env.VITEST === "true" || process.env.CI === "true";
  const isLocalDev = !isTestRuntime && process.env.NODE_ENV !== "production";
  const explicitBypass = isLocalDev && (enableFlag === "true" || enableFlag === "1");
  const missingSupabaseConfig = isLocalDev && !isSupabaseAuthConfigured();

  if (!(explicitBypass || missingSupabaseConfig)) return null;

  const role = (process.env.LOCAL_DEV_AUTH_ROLE ?? "student").trim().toLowerCase();
  const allowedRoles = new Set(["student", "admin", "super_admin", "content_manager", "reviewer"]);
  const resolvedRole = allowedRoles.has(role) ? role : "student";

  const userId = process.env.LOCAL_DEV_AUTH_USER_ID ?? "local-dev-user";
  const email = process.env.LOCAL_DEV_AUTH_EMAIL ?? "dev@example.com";
  const fullName = process.env.LOCAL_DEV_AUTH_NAME ?? "Local Dev User";

  const profile: Profile = {
    id: userId,
    email,
    full_name: fullName,
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
    role_id: null,
    is_active: true,
    roles: [{ code: resolvedRole, name: resolvedRole === "student" ? "Student" : "Admin" }],
  };

  const user: User = {
    id: userId,
    email,
    app_metadata: {},
    user_metadata: { full_name: fullName },
    aud: "authenticated",
    created_at: new Date().toISOString(),
    email_confirmed_at: new Date().toISOString(),
  };

  return { user, profile };
}

export async function requireAuth() {
  const devSession = getDevBypassSession();
  if (devSession) return devSession;

  const user = await getSessionUser();
  if (!user) return null;
  const profile = await ensureProfile(user);
  if (profile.is_active !== true) {
    throw new ApiError(403, "Account deactivated", "ACCOUNT_DEACTIVATED");
  }
  return { user, profile };
}

export async function requireAdminAuth() {
  const session = await requireAuth();
  if (!session) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const roleCode = normalizeRoleCode(session.profile);
  if (!roleCode || !isPrivilegedAdminRole(roleCode)) {
    throw new ApiError(403, "Forbidden", "FORBIDDEN");
  }

  return session;
}

export async function requireAdminRole(allowedRoles: string[]) {
  const session = await requireAuth();
  if (!session) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const roleCode = normalizeRoleCode(session.profile);
  if (!roleCode || !allowedRoles.includes(roleCode)) {
    throw new ApiError(403, "Forbidden", "FORBIDDEN");
  }
  return session;
}
