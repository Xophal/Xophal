import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { assertTrustedOrigin, getAppOrigin } from "@/lib/api-utils";

function makeRequest(headers: Record<string, string>) {
  return new NextRequest("https://app.xophol.com/api/auth/login", { method: "POST", headers });
}

describe("assertTrustedOrigin", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const originalTrustedOrigins = process.env.TRUSTED_ORIGINS;

  beforeEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.xophol.com";
    delete process.env.TRUSTED_ORIGINS;
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv ?? "test";
    if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    if (originalTrustedOrigins === undefined) delete process.env.TRUSTED_ORIGINS;
    else process.env.TRUSTED_ORIGINS = originalTrustedOrigins;
  });

  it("returns the canonical app origin", () => {
    expect(getAppOrigin()).toBe("https://app.xophol.com");
  });

  it("accepts a same-origin request", () => {
    expect(() => assertTrustedOrigin(makeRequest({ origin: "https://app.xophol.com" }))).not.toThrow();
  });

  it("rejects a cross-site origin in production", () => {
    expect(() => assertTrustedOrigin(makeRequest({ origin: "https://evil.example" }))).toThrow();
  });

  it("rejects an unlisted sibling subdomain of the app domain", () => {
    // Regression: comparing only the registrable domain previously trusted ANY
    // subdomain of xophol.com, which is a CSRF bypass.
    expect(() => assertTrustedOrigin(makeRequest({
      origin: "https://evil.xophol.com",
      host: "app.xophol.com",
    }))).toThrow();
  });

  it("accepts an explicitly trusted host alias", () => {
    process.env.TRUSTED_ORIGINS = "https://www.xophol.com";
    expect(() => assertTrustedOrigin(makeRequest({
      origin: "https://www.xophol.com",
      host: "app.xophol.com",
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
