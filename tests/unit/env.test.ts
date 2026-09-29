import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
delete process.env.NEXT_PUBLIC_APP_URL;
describe("environment configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  });

  it("falls back to safe defaults when public env vars are missing", async () => {
    const { publicEnv } = await import("@/lib/env");

    expect(publicEnv.NEXT_PUBLIC_SUPABASE_URL).toBe("https://placeholder.supabase.co");
    expect(publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("placeholder-anon-key");
    expect(publicEnv.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("uses the standard Supabase env vars when the public ones are missing", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "example-anon-key";

    const { publicEnv } = await import("@/lib/env");

    expect(publicEnv.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
    expect(publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("example-anon-key");
  });

  it("normalizes Supabase URLs that include the REST endpoint", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co/rest/v1";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "example-anon-key";

    const { publicEnv } = await import("@/lib/env");

    expect(publicEnv.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
  });

  describe("production app URL guard", () => {
    // `validateEnv` reads process.env at call time, so there is no need to
    // reset modules or stub the environment here; the spy captures the
    // [config] lines it writes. NODE_ENV is typed read-only, so it is set
    // through a narrow cast rather than a direct assignment.
    function setNodeEnv(value: string) {
      (process.env as Record<string, string | undefined>).NODE_ENV = value;
    }

    async function captureWarnings(appUrl: string, nodeEnv: string) {
      const previousNodeEnv = process.env.NODE_ENV;
      setNodeEnv(nodeEnv);
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
      process.env.NEXT_PUBLIC_APP_URL = appUrl;

      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { validateEnv } = await import("@/lib/env.server");
      validateEnv();
      const warnings = warn.mock.calls.map((call) => String(call[0]));
      warn.mockRestore();

      setNodeEnv(previousNodeEnv ?? "test");
      return warnings;
    }

    it("warns when a production app URL still points at a Vercel host", async () => {
      const warnings = await captureWarnings(
        "https://xophal-ksec4eb36-xophal.vercel.app",
        "production"
      );

      expect(warnings.filter((w) => w.includes("NEXT_PUBLIC_APP_URL"))).not.toHaveLength(0);
    });

    it("stays silent for a custom domain", async () => {
      const warnings = await captureWarnings("https://xophol.com", "production");

      expect(warnings.filter((w) => w.includes("NEXT_PUBLIC_APP_URL"))).toHaveLength(0);
    });

    it("does not warn outside production", async () => {
      const warnings = await captureWarnings(
        "https://xophal-ksec4eb36-xophal.vercel.app",
        "development"
      );

      expect(warnings.filter((w) => w.includes("NEXT_PUBLIC_APP_URL"))).toHaveLength(0);
    });
  });
});
