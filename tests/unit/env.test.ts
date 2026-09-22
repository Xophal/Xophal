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
});
