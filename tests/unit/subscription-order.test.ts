import { describe, expect, it } from "vitest";

import { POST as createSubscriptionOrder } from "@/app/api/payments/route";
import { POST as createMockTestOrder } from "@/app/api/create-order/route";

async function expectManualUpiOnly(response: Response) {
  expect(response.status).toBe(503);
  await expect(response.json()).resolves.toMatchObject({
    success: false,
    code: "MANUAL_UPI_REQUIRED",
  });
}

describe("legacy Razorpay order endpoints", () => {
  it("requires manual UPI for subscriptions", async () => {
    await expectManualUpiOnly(await createSubscriptionOrder());
  });

  it("requires manual UPI for mock tests", async () => {
    await expectManualUpiOnly(await createMockTestOrder());
  });
});
