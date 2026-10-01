import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const requiredEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  NEXT_PUBLIC_APP_URL: "https://app.xophol.com",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  UPSTASH_REDIS_REST_URL: "https://region.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "redis-token",
  RESEND_API_KEY: "resend-key",
  RESEND_FROM: "Xophol <notify@xophol.com>",
  MAIN_ADMIN_EMAILS: "admin1@xophol.com,admin2@xophol.com",
  RAZORPAY_KEY_ID: "rzp_live_key",
  RAZORPAY_KEY_SECRET: "razorpay-key-secret",
  RAZORPAY_WEBHOOK_SECRET: "razorpay-webhook-secret",
};

const envKeys = [...Object.keys(requiredEnv), "LOCAL_DEV_SKIP_AUTH", "RAZORPAY_ROUTE_ENABLED", "RAZORPAY_ROUTE_WEBHOOK_SECRET"];
const deployCheckPath = resolve(process.cwd(), "scripts/deploy-check.js");
let isolatedWorkingDirectory: string;

function runDeployCheck(overrides: Record<string, string | undefined> = {}) {
  const env = { ...process.env };
  for (const key of envKeys) delete env[key];
  Object.assign(env, requiredEnv);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }

  return spawnSync(process.execPath, [deployCheckPath], {
    cwd: isolatedWorkingDirectory,
    env,
    encoding: "utf8",
  });
}

describe("deployment readiness check", () => {
  beforeEach(() => {
    isolatedWorkingDirectory = mkdtempSync(join(tmpdir(), "xophol-deploy-check-"));
  });

  afterEach(() => {
    rmSync(isolatedWorkingDirectory, { recursive: true, force: true });
  });

  it("accepts a complete production configuration", () => {
    const result = runDeployCheck();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("present and valid");
  });

  it("rejects missing required configuration", () => {
    const result = runDeployCheck({ UPSTASH_REDIS_REST_TOKEN: undefined });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("UPSTASH_REDIS_REST_TOKEN");
  });

  it("rejects insecure URLs and the local authentication bypass", () => {
    const insecureUrl = runDeployCheck({ NEXT_PUBLIC_APP_URL: "http://app.xophol.com" });
    const localBypass = runDeployCheck({ LOCAL_DEV_SKIP_AUTH: "true" });

    expect(insecureUrl.status).toBe(1);
    expect(insecureUrl.stderr).toContain("NEXT_PUBLIC_APP_URL must use HTTPS");
    expect(localBypass.status).toBe(1);
    expect(localBypass.stderr).toContain("LOCAL_DEV_SKIP_AUTH must not be enabled");
  });

  it("requires two distinct valid admin approver emails", () => {
    const result = runDeployCheck({ MAIN_ADMIN_EMAILS: "admin@xophol.com,admin@xophol.com" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("MAIN_ADMIN_EMAILS must contain exactly two distinct valid email addresses");
  });

  it("requires a dedicated Route webhook secret only when seller payouts are enabled", () => {
    const missingSecret = runDeployCheck({ RAZORPAY_ROUTE_ENABLED: "true" });
    const configured = runDeployCheck({
      RAZORPAY_ROUTE_ENABLED: "true",
      RAZORPAY_ROUTE_WEBHOOK_SECRET: "route-webhook-secret",
    });

    expect(missingSecret.status).toBe(1);
    expect(missingSecret.stderr).toContain("RAZORPAY_ROUTE_WEBHOOK_SECRET");
    expect(configured.status).toBe(0);
  });
});