import { ADMIN_ROLES } from "@/constants";

export function normalizeRoleCode(role: unknown): string | null {
  if (!role) return null;

  if (typeof role === "string") {
    return role.trim().toLowerCase();
  }

  if (typeof role !== "object") {
    return null;
  }

  const roleObj = role as Record<string, unknown>;
  if (typeof roleObj.code === "string") {
    return roleObj.code.trim().toLowerCase();
  }

  if (Array.isArray(roleObj.roles)) {
    return normalizeRoleCode(roleObj.roles[0] ?? null);
  }

  if (roleObj.roles && typeof roleObj.roles === "object") {
    return normalizeRoleCode(roleObj.roles);
  }

  return null;
}

export function isAdminRole(role: unknown): boolean {
  const roleCode = normalizeRoleCode(role);
  return !!roleCode && ADMIN_ROLES.includes(roleCode as (typeof ADMIN_ROLES)[number]);
}

export function isStudentRole(role: unknown): boolean {
  const roleCode = normalizeRoleCode(role);
  return roleCode === "student";
}
