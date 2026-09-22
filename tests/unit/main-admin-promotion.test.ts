import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as authModule from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";

const SUPER_ADMIN_ROLE_ID = "role-super";
const updateEqMock = vi.fn();
const superAdminRow = { id: SUPER_ADMIN_ROLE_ID, code: "super_admin", name: "Super Admin" };

// Follows the same vi.hoisted + vi.mock convention used in otp-auth.test.ts so
// the mock return type doesn't clash with the real SupabaseClient shape.
const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

function buildClient(): any {
  const from = (table: string) => {
    if (table === "roles") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: superAdminRow, error: null }),
          }),
        }),
      };
    }
    if (table === "profiles") {
      return {
        update: () => {
          updateEqMock();
          return { eq: vi.fn(() => Promise.resolve({ data: null, error: null })) };
        },
      };
    }
    return {};
  };
  return { from };
}

describe("promoteMainAdminProfile", () => {
  beforeAll(() => {
    process.env.MAIN_ADMIN_EMAILS = "main@xophal.com,second@xophal.com";
  });

  afterAll(() => {
    delete process.env.MAIN_ADMIN_EMAILS;
  });

  beforeEach(() => {
    updateEqMock.mockClear();
    mocks.createAdminClient.mockClear();
    mocks.createAdminClient.mockReturnValue(buildClient());
  });

  it("is a no-op for anyone not in MAIN_ADMIN_EMAILS", async () => {
    const profile = { id: "u1", email: "student@example.com", role_id: null, roles: [{ code: "student" }] } as any;

    const result = await authModule.promoteMainAdminProfile({
      userId: "u1",
      email: "student@example.com",
      profile,
    });

    expect(result).toBe(profile);
    expect(updateEqMock).not.toHaveBeenCalled();
  });

  it("promotes a main administrator whose profile still has a student role", async () => {
    const profile = { id: "u2", email: "main@xophal.com", is_active: true, role_id: null, roles: [{ code: "student" }] } as any;

    const result = await authModule.promoteMainAdminProfile({
      userId: "u2",
      email: "main@xophal.com",
      profile,
    });

    expect(result?.role_id).toBe(SUPER_ADMIN_ROLE_ID);
    expect((result?.roles as any[])[0].code).toBe("super_admin");
    expect(isAdminRole(result)).toBe(true);
    expect(updateEqMock).toHaveBeenCalledTimes(1);
  });

  it("leaves an already-privileged main administrator alone (no database write)", async () => {
    const profile = { id: "u3", email: "second@xophal.com", role_id: "role-admin", roles: [{ code: "admin" }] } as any;

    const result = await authModule.promoteMainAdminProfile({
      userId: "u3",
      email: "second@xophal.com",
      profile,
    });

    expect(result).toBe(profile);
    expect(updateEqMock).not.toHaveBeenCalled();
  });

  it("returns an admin-shaped profile when no profile row exists yet", async () => {
    const result = await authModule.promoteMainAdminProfile({
      userId: "u4",
      email: "main@xophal.com",
      profile: null,
    });

    expect(result).not.toBeNull();
    expect(result!.role_id).toBe(SUPER_ADMIN_ROLE_ID);
    expect(isAdminRole(result)).toBe(true);
    expect(updateEqMock).toHaveBeenCalledTimes(1);
  });

  it("is case-insensitive when matching a main administrator email", async () => {
    const result = await authModule.promoteMainAdminProfile({
      userId: "u5",
      email: " Main@Xophal.com ",
      profile: null,
    });

    expect(isAdminRole(result)).toBe(true);
  });
});