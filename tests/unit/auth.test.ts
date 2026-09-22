import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-utils";

// Module under test
import * as authModule from "@/lib/auth";
import * as supabaseServer from "@/lib/supabase/server";

describe("requireAdminAuth", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns user and profile when user is admin and active", async () => {
    const mockClient: any = {};
    mockClient.auth = {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com", email_confirmed_at: "2020-01-01" } } }),
    };

    const singleMock = vi.fn().mockResolvedValue({ data: { id: "u1", is_active: true, roles: { code: "admin" } } });
    mockClient.from = vi.fn(() => ({ select: () => ({ eq: () => ({ single: singleMock }) }) }));

    vi.spyOn(supabaseServer, "createClient").mockResolvedValue(mockClient as any);

    const result = await authModule.requireAdminAuth();
    expect(result).toBeDefined();
    expect(result?.user?.id).toBe("u1");
    expect(result?.profile?.roles?.code).toBe("admin");
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
    mockClient.from = vi.fn(() => ({ select: () => ({ eq: () => ({ single: singleMock }) }) }));

    vi.spyOn(supabaseServer, "createClient").mockResolvedValue(mockClient as any);

    await expect(authModule.requireAdminAuth()).rejects.toBeInstanceOf(ApiError);
    await expect(authModule.requireAdminAuth()).rejects.toMatchObject({ statusCode: 403 });
  });

  it("throws 403 when profile is deactivated", async () => {
    const mockClient: any = {};
    mockClient.auth = { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u3", email: "u3@x.com", email_confirmed_at: "2020-01-01" } } }) };
    const singleMock = vi.fn().mockResolvedValue({ data: { id: "u3", is_active: false, roles: { code: "admin" } } });
    mockClient.from = vi.fn(() => ({ select: () => ({ eq: () => ({ single: singleMock }) }) }));

    vi.spyOn(supabaseServer, "createClient").mockResolvedValue(mockClient as any);

    await expect(authModule.requireAdminAuth()).rejects.toBeInstanceOf(ApiError);
    await expect(authModule.requireAdminAuth()).rejects.toMatchObject({ statusCode: 403 });
  });
});

import { buildProfileUpsertPayload, isAdminRole, isStudentRole, normalizeRoleCode } from "@/lib/auth";
import { adminRegisterSchema } from "@/lib/validations";

describe("profile payload helpers", () => {
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
      email: "admin@xophal.com",
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
