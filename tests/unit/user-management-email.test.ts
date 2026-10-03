import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-utils";
import {
  createRoleInvitationToken,
  hashRoleInvitationToken,
  getRoleInvitationExpiry,
  sendAccountStatusEmail,
  sendRoleInvitationEmail,
} from "@/lib/user-management-email";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("user management email helpers", () => {
  it("generates a high-entropy token and stores only its SHA-256 digest", () => {
    const first = createRoleInvitationToken();
    const second = createRoleInvitationToken();

    expect(first.token).toMatch(/^[a-f0-9]{64}$/);
    expect(first.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.tokenHash).toBe(hashRoleInvitationToken(first.token));
    expect(first.tokenHash).not.toBe(first.token);
    expect(second.token).not.toBe(first.token);
  });

  it("sets the invitation expiry within the seven-day acceptance window", () => {
    const before = Date.now();
    const expiry = Date.parse(getRoleInvitationExpiry());
    expect(expiry).toBeGreaterThan(before + 6 * 24 * 60 * 60 * 1000);
    expect(expiry).toBeLessThanOrEqual(before + 7 * 24 * 60 * 60 * 1000 + 1000);
  });

  it("sends a role invitation with escaped user content and response link", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("RESEND_FROM", "Xophol <notify@example.test>");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendRoleInvitationEmail({
      email: "person@example.test",
      fullName: "<img src=x onerror=alert(1)>",
      roleName: "Content Manager",
      token: "a".repeat(64),
    });

    const request = fetchMock.mock.calls[0];
    const payload = JSON.parse(String(request[1]?.body)) as { to: string[]; html: string; subject: string };
    expect(payload.to).toEqual(["person@example.test"]);
    expect(payload.subject).toContain("role invitation");
    expect(payload.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(payload.html).not.toContain("<img src=x");
    expect(payload.html).toContain("account/role-invitation?token=");
    expect(payload.html).toContain("a".repeat(64));
  });

  it("emails activation and deactivation state changes", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("RESEND_FROM", "Xophol <notify@example.test>");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendAccountStatusEmail({ email: "person@example.test", fullName: "Student", isActive: false });
    await sendAccountStatusEmail({ email: "person@example.test", fullName: "Student", isActive: true });

    const payloads = fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)) as { subject: string; html: string });
    expect(payloads[0].subject).toContain("deactivated");
    expect(payloads[0].html).toContain("Sign-in to your account is currently blocked");
    expect(payloads[1].subject).toContain("activated");
    expect(payloads[1].html).toContain("sign in to your account again");
  });

  it("surfaces missing mail configuration and provider rejection", async () => {
    await expect(sendAccountStatusEmail({ email: "person@example.test", fullName: null, isActive: true }))
      .rejects.toMatchObject({ statusCode: 503 });

    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("RESEND_FROM", "Xophol <notify@example.test>");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(sendRoleInvitationEmail({
      email: "person@example.test",
      fullName: null,
      roleName: "Content Manager",
      token: "b".repeat(64),
    })).rejects.toBeInstanceOf(ApiError);
  });
});
