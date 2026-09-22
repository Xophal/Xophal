import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyRazorpaySignature } from "@/lib/razorpay";

describe("verifyRazorpaySignature", () => {
  const payload = JSON.stringify({ event: "payment.captured" });
  const secret = "test-webhook-secret";

  it("accepts a valid signature", () => {
    const signature = createHmac("sha256", secret).update(payload).digest("hex");
    expect(verifyRazorpaySignature(payload, signature, secret)).toBe(true);
  });

  it("rejects missing or invalid signatures", () => {
    expect(verifyRazorpaySignature(payload, null, secret)).toBe(false);
    expect(verifyRazorpaySignature(payload, "invalid", secret)).toBe(false);
  });
});