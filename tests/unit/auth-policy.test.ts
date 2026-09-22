import { describe, expect, it } from "vitest";
import { assertAccess, canAccessPremiumContent, getAccessState } from "@/lib/auth-policy";
import { normalizeRoleCode } from "@/lib/roles";

describe("auth policy", () => {
  it("normalizes role codes for consistent authorization", () => {
    expect(normalizeRoleCode(" Reviewer ")).toBe("reviewer");
    expect(normalizeRoleCode({ code: "CONTENT_MANAGER" })).toBe("content_manager");
  });

  it("builds a full access state for a verified active student", () => {
    const state = getAccessState(
      {
        is_active: true,
        email_verified: true,
        roles: [{ code: "student" }],
      },
      { email_confirmed_at: "2024-01-01T00:00:00Z" }
    );

    expect(state.isAuthenticated).toBe(true);
    expect(state.isActive).toBe(true);
    expect(state.isVerified).toBe(true);
    expect(state.isAdmin).toBe(false);
    expect(state.roleCode).toBe("student");
  });

  it("allows admins through the admin gate", () => {
    const result = assertAccess(
      {
        is_active: true,
        email_verified: true,
        roles: [{ code: "admin" }],
      },
      { email_confirmed_at: "2024-01-01T00:00:00Z" },
      { requireAuth: true, allowRoles: ["admin", "super_admin"] }
    );

    expect(result.isAdmin).toBe(true);
    expect(result.roleCode).toBe("admin");
  });

  it("rejects unverified users when email verification is required", () => {
    expect(() =>
      assertAccess(
        {
          is_active: true,
          email_verified: false,
          roles: [{ code: "student" }],
        },
        { email_confirmed_at: null },
        { requireAuth: true, requireEmailVerified: true }
      )
    ).toThrow("Email verification required");
  });

  it("rejects non-admin users on admin routes", () => {
    expect(() =>
      assertAccess(
        {
          is_active: true,
          email_verified: true,
          roles: [{ code: "student" }],
        },
        { email_confirmed_at: "2024-01-01T00:00:00Z" },
        { requireAuth: true, allowRoles: ["admin", "super_admin"] }
      )
    ).toThrow("Access denied");
  });

  it("allows premium access when the subscription is active and unexpired", () => {
    const result = canAccessPremiumContent(
      { is_active: true, email_verified: true, roles: [{ code: "student" }] },
      { email_confirmed_at: "2024-01-01T00:00:00Z" },
      { status: "active", expires_at: new Date(Date.now() + 86400000).toISOString() }
    );

    expect(result.allowed).toBe(true);
  });

  it("blocks premium access when the subscription is expired", () => {
    const result = canAccessPremiumContent(
      { is_active: true, email_verified: true, roles: [{ code: "student" }] },
      { email_confirmed_at: "2024-01-01T00:00:00Z" },
      { status: "active", expires_at: new Date(Date.now() - 86400000).toISOString() }
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("Premium access required");
  });
});
