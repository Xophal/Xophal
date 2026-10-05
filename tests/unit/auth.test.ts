import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-utils";

// Module under test
import * as authModule from "@/lib/auth";
import * as supabaseServer from "@/lib/supabase/server";
import * as supabaseAdmin from "@/lib/supabase/admin";

describe("requireAdminAuth", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns user and profile when user is admin and active", async () => {
    const mockClient: any = {};
    mockClient.auth = {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com", email_confirmed_at: "2020-01-01" } } }),
    };

    const singleMock = vi.fn().mockResolvedValue({ data: { id: "u1", is_active: true, roles: [{ code: "admin", name: "Admin" }] } });
    mockClient.from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: singleMock }) }) }));

    vi.spyOn(supabaseServer, "createClient").mockResolvedValue(mockClient as any);

    const result = await authModule.requireAdminAuth();
    expect(result).toBeDefined();
    expect(result?.user?.id).toBe("u1");
    expect(result?.profile?.roles?.[0]?.code).toBe("admin");
  });

  it("throws 401 when not authenticated", async () => {
    const mockClient: any = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } };
    vi.spyOn(supabaseServer, "createClient").mockResolvedValue(mockClient as any);

    await expect(authModule.requireAdminAuth()).rejects.toBeInstanceOf(ApiError);
    await expect(authModule.requireAdminAuth()).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 403 when profile is not admin", async () => {
    const mockClient: any = {};
    mockClient.auth = { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u2", email: "u2@x.com", email_confirmed_at: "2020-01-01" } } }) };
    const singleMock = vi.fn().mockResolvedValue({ data: { id: "u2", is_active: true, roles: { code: "student" } } });
    mockClient.from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: singleMock }) }) }));

    vi.spyOn(supabaseServer, "createClient").mockResolvedValue(mockClient as any);

    await expect(authModule.requireAdminAuth()).rejects.toBeInstanceOf(ApiError);
    await expect(authModule.requireAdminAuth()).rejects.toMatchObject({ statusCode: 403 });
  });

  it("keeps reviewer access limited to explicitly allowed roles", async () => {
    const mockClient: any = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "reviewer-1", email: "reviewer@example.com", email_confirmed_at: "2020-01-01" } },
        }),
      },
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "reviewer-1", is_active: true, roles: [{ code: "reviewer", name: "Reviewer" }] },
              error: null,
            }),
          }),
        }),
      })),
    };
    vi.spyOn(supabaseServer, "createClient").mockResolvedValue(mockClient);

    await expect(authModule.requireAdminAuth()).rejects.toMatchObject({ statusCode: 403 });
    await expect(authModule.requireAdminRole(["reviewer"])).resolves.toMatchObject({
      profile: { id: "reviewer-1" },
    });
  });

  it("throws 403 when profile is deactivated", async () => {
    const mockClient: any = {};
    mockClient.auth = { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u3", email: "u3@x.com", email_confirmed_at: "2020-01-01" } } }) };
    const singleMock = vi.fn().mockResolvedValue({ data: { id: "u3", is_active: false, roles: { code: "admin" } } });
    mockClient.from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: singleMock }) }) }));

    vi.spyOn(supabaseServer, "createClient").mockResolvedValue(mockClient as any);

    await expect(authModule.requireAdminAuth()).rejects.toBeInstanceOf(ApiError);
    await expect(authModule.requireAdminAuth()).rejects.toMatchObject({ statusCode: 403 });
  });

  it("accepts a verified profile even if email_confirmed_at is missing", async () => {
    const mockClient: any = {};
    mockClient.auth = { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u4", email: "u4@x.com" } } }) };
    const singleMock = vi.fn().mockResolvedValue({ data: { id: "u4", is_active: true, email_verified: true, roles: { code: "student" } } });
    mockClient.from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: singleMock }) }) }));

    vi.spyOn(supabaseServer, "createClient").mockResolvedValue(mockClient as any);

    await expect(authModule.requireAuth()).resolves.toMatchObject({
      user: { id: "u4" },
      profile: { id: "u4", email_verified: true },
    });
  });

  it("allows a local development bypass when explicitly enabled", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VITEST", "false");
    vi.stubEnv("LOCAL_DEV_SKIP_AUTH", "true");
    vi.stubEnv("LOCAL_DEV_AUTH_ROLE", "student");

    try {
      await expect(authModule.requireAuth()).resolves.toMatchObject({
        user: { id: "local-dev-user", email: "dev@example.com" },
        profile: { id: "local-dev-user", full_name: "Local Dev User" },
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("ensureProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("repairs an existing profile with no role as a student", async () => {
    const user = { id: "u5", email: "student@example.com" } as any;
    const profileWithoutRole = { id: user.id, role_id: null, roles: null };
    const profileWithRole = { ...profileWithoutRole, role_id: "student-role", roles: { code: "student" } };
    const profileResult = vi.fn()
      .mockResolvedValueOnce({ data: profileWithoutRole, error: null })
      .mockResolvedValueOnce({ data: profileWithRole, error: null });
    const supabaseClient: any = {
      from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: profileResult }) }) })),
    };
    const roleLookup = vi.fn().mockResolvedValue({ data: { id: "student-role" } });
    const updateProfile = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const adminClient: any = {
      from: vi.fn((table: string) => table === "roles"
        ? { select: () => ({ eq: () => ({ maybeSingle: roleLookup }) }) }
        : { update: updateProfile }),
    };
    vi.spyOn(supabaseServer, "createClient").mockResolvedValue(supabaseClient);
    vi.spyOn(supabaseAdmin, "createAdminClient").mockReturnValue(adminClient);

    await expect(authModule.ensureProfile(user)).resolves.toEqual(profileWithRole);
    expect(updateProfile).toHaveBeenCalledWith({ role_id: "student-role" });
    expect(profileResult).toHaveBeenCalledTimes(2);
  });

  it("does not provision or overwrite a profile when its lookup fails", async () => {
    const user = { id: "u6", email: "student@example.com" } as any;
    const lookup = vi.fn().mockResolvedValue({ data: null, error: { message: "database unavailable" } });
    const supabaseClient: any = {
      from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: lookup }) }) })),
    };
    vi.spyOn(supabaseServer, "createClient").mockResolvedValue(supabaseClient);
    const createAdminClient = vi.spyOn(supabaseAdmin, "createAdminClient");

    await expect(authModule.ensureProfile(user)).rejects.toMatchObject({
      statusCode: 503,
      code: "PROFILE_LOOKUP_FAILED",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});

import { buildProfileUpsertPayload, isAdminRole, isStudentRole, normalizeRoleCode } from "@/lib/auth";
import { isUserEmailVerified } from "@/lib/auth-policy";
import { adminRegisterSchema } from "@/lib/validations";

describe("profile payload helpers", () => {
  it("uses the same verification rule for confirmed, social, and profile-verified users", () => {
    expect(isUserEmailVerified({ email_confirmed_at: "2025-01-01", app_metadata: {} })).toBe(true);
    expect(isUserEmailVerified({ email_confirmed_at: null, app_metadata: { provider: "google" } })).toBe(true);
    expect(isUserEmailVerified({ email_confirmed_at: null, app_metadata: { provider: "email" } }, { email_verified: true })).toBe(true);
    expect(isUserEmailVerified({ email_confirmed_at: null, app_metadata: { provider: "email" } })).toBe(false);
  });

  it("builds a profile payload that preserves the selected board and class", () => {
    expect(
      buildProfileUpsertPayload("user-123", {
        fullName: "Ananya Bora",
        email: "ananya@example.com",
        boardId: "board-1",
        classId: "class-9",
      })
    ).toEqual({
      id: "user-123",
      email: "ananya@example.com",
      full_name: "Ananya Bora",
      phone: null,
      board_id: "board-1",
      class_id: "class-9",
      role_id: null,
      email_verified: false,
    });
  });

  it("normalizes student and admin role codes correctly", () => {
    expect(normalizeRoleCode({ code: "student" })).toBe("student");
    expect(normalizeRoleCode({ roles: { code: "student" } })).toBe("student");
    expect(normalizeRoleCode({ roles: [{ code: "admin" }] })).toBe("admin");
    expect(normalizeRoleCode(null)).toBeNull();
  });

  it("correctly identifies admin and student roles", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("content_manager")).toBe(true);
    expect(isStudentRole("student")).toBe(true);
    expect(isStudentRole("admin")).toBe(false);
  });

  it("accepts admin-only registration data without student board or class fields", () => {
    const result = adminRegisterSchema.safeParse({
      fullName: "Saurabh Sharma",
      email: "admin@xophol.com",
      phone: "+91 9876543210",
      role: "content_manager",
      password: "securepassword",
      confirmPassword: "securepassword",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("content_manager");
      expect(result.data).not.toHaveProperty("boardId");
      expect(result.data).not.toHaveProperty("classId");
    }
  });
});
