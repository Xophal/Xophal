import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { assertTrustedOrigin, getAppOrigin } from "@/lib/api-utils";

function makeRequest(headers: Record<string, string>) {
  return new NextRequest("https://app.xophal.com/api/auth/login", { method: "POST", headers });
}

describe("assertTrustedOrigin", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.xophal.com";
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv ?? "test";
    if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it("returns the canonical app origin", () => {
    expect(getAppOrigin()).toBe("https://app.xophal.com");
  });

  it("accepts a same-origin request", () => {
    expect(() => assertTrustedOrigin(makeRequest({ origin: "https://app.xophal.com" }))).not.toThrow();
  });

  it("rejects a cross-site origin in production", () => {
    expect(() => assertTrustedOrigin(makeRequest({ origin: "https://evil.example" }))).toThrow();
  });

  it("accepts same-site host aliases such as www and apex domains", () => {
    expect(() => assertTrustedOrigin(makeRequest({
      origin: "https://www.xophal.com",
      host: "app.xophal.com",
    }))).not.toThrow();
  });

  it("allows requests with no origin header (server-to-server / tests)", () => {
    expect(() => assertTrustedOrigin(makeRequest({}))).not.toThrow();
  });

  it("never blocks mismatched origins outside production", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    expect(() => assertTrustedOrigin(makeRequest({ origin: "https://evil.example" }))).not.toThrow();
  });
});
