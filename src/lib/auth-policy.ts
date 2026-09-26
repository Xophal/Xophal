import { isAdminRole, normalizeRoleCode } from "@/lib/roles";

export type AuthAccessOptions = {
  requireAuth?: boolean;
  requireEmailVerified?: boolean;
  requireActive?: boolean;
  allowRoles?: Array<string>;
  allowAdmin?: boolean;
};

export type AccessState = {
  isAuthenticated: boolean;
  isActive: boolean;
  isVerified: boolean;
  isAdmin: boolean;
  roleCode: string | null;
  reason?: string;
};

function getRoleCode(profileOrRole: unknown): string | null {
  if (!profileOrRole) return null;

  const normalized = normalizeRoleCode(profileOrRole);
  if (normalized) return normalized;

  const roleRecord = profileOrRole as Record<string, unknown>;
  if (roleRecord?.roles && typeof roleRecord.roles === "object") {
    return getRoleCode(roleRecord.roles);
  }

  return null;
}

export function getAccessState(profile: any, session: any, options: AuthAccessOptions = {}): AccessState {
  const roleCode = getRoleCode(profile);
  const hasSession = Boolean(session && typeof session === "object");
  const isAuthenticated = hasSession && Boolean(profile);
  const isActive = Boolean(profile?.is_active !== false);
  const isVerified = Boolean(profile?.email_verified || session?.email_confirmed_at);
  const isAdmin = isAdminRole(profile) || (roleCode ? ["admin", "super_admin", "content_manager", "reviewer"].includes(roleCode) : false);

  let reason: string | undefined;

  if (options.requireAuth && !isAuthenticated) {
    reason = "Authentication required";
  } else if (options.requireEmailVerified && !isVerified) {
    reason = "Email verification required";
  } else if (options.requireActive && !isActive) {
    reason = "Account inactive";
  } else if (options.allowRoles && (!roleCode || !options.allowRoles.includes(roleCode))) {
    // A missing/unresolvable role must fail closed. Previously the `roleCode &&`
    // guard let a profile with no role skip this check entirely and be granted
    // access to role-restricted routes.
    reason = "Access denied";
  } else if (options.allowAdmin && !isAdmin) {
    reason = "Access denied";
  }

  return {
    isAuthenticated,
    isActive,
    isVerified,
    isAdmin,
    roleCode,
    reason,
  };
}

export function assertAccess(profile: any, session: any, options: AuthAccessOptions = {}): AccessState {
  const state = getAccessState(profile, session, options);

  if (state.reason) {
    throw new Error(state.reason);
  }

  return state;
}

export function requireVerifiedSession(profile: any, session: any, options: AuthAccessOptions = {}) {
  return assertAccess(profile, session, {
    requireAuth: true,
    requireActive: true,
    requireEmailVerified: true,
    ...options,
  });
}

export function canAccessPremiumContent(
  profile: any,
  session: any,
  subscriptionState?: { status?: string; expires_at?: string | null; is_active?: boolean } | null
): { allowed: boolean; reason?: string } {
  // Use getAccessState (non-throwing) rather than assertAccess: this function is
  // a predicate that reports denial via `allowed: false`. assertAccess threw on
  // failure, which made the `!access.isAuthenticated` branch below unreachable
  // and crashed callers that legitimately expected a boolean result.
  const access = getAccessState(profile, session, {
    requireAuth: true,
    requireActive: true,
    requireEmailVerified: true,
  });

  if (!access.isAuthenticated || access.reason) {
    return { allowed: false, reason: access.reason || "Authentication required" };
  }

  const normalizedStatus = String(subscriptionState?.status || "").toLowerCase();
  const expiresAt = subscriptionState?.expires_at;
  const isActiveSubscription = Boolean(
    subscriptionState &&
      subscriptionState.is_active !== false &&
      (normalizedStatus === "active" || normalizedStatus === "trial") &&
      (!expiresAt || new Date(expiresAt).getTime() > Date.now())
  );

  if (isActiveSubscription) {
    return { allowed: true };
  }

  return { allowed: false, reason: "Premium access required" };
}
