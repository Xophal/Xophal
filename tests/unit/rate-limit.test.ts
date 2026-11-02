import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  apiRateLimit: { limit: mocks.limit },
}));

import { checkRateLimit } from "@/lib/rate-limit";

describe("API rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows requests accepted by the limiter", async () => {
    mocks.limit.mockResolvedValue({ success: true });

    await expect(checkRateLimit(new NextRequest("http://localhost/api/test"))).resolves.toBeUndefined();
    expect(mocks.limit).toHaveBeenCalledWith("anonymous");
  });

  it("rejects requests over the configured limit", async () => {
    mocks.limit.mockResolvedValue({ success: false });

    await expect(checkRateLimit(new NextRequest("http://localhost/api/test")))
      .rejects.toMatchObject({ message: "RATE_LIMIT" });
  });

  it("fails closed when the limiter service is unavailable", async () => {
    mocks.limit.mockRejectedValue(new Error("provider failure"));
    const logError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(checkRateLimit(new NextRequest("http://localhost/api/test")))
      .rejects.toMatchObject({
        statusCode: 503,
        code: "RATE_LIMIT_UNAVAILABLE",
      });

    expect(logError).toHaveBeenCalledWith("[rate-limit] API limiter is unavailable.");
    logError.mockRestore();
  });
});
