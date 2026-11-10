import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/ebooks/checkout/route";

describe("legacy Razorpay eBook checkout", () => {
  it("requires manual UPI checkout", async () => {
    const response = await POST();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "MANUAL_UPI_REQUIRED",
    });
  });
});
