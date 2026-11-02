import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api-utils";
import { apiRateLimit } from "@/lib/redis";

export async function checkRateLimit(request: NextRequest) {
  if (!apiRateLimit) {
    if (process.env.NODE_ENV === "production") {
      throw new ApiError(503, "Request protection is temporarily unavailable.", "RATE_LIMIT_NOT_CONFIGURED");
    }
    return;
  }

  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anonymous";

  let success: boolean;
  try {
    ({ success } = await apiRateLimit.limit(ip));
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") {
      throw error;
    }
    console.error("[rate-limit] API limiter is unavailable.");
    throw new ApiError(503, "Request protection is temporarily unavailable.", "RATE_LIMIT_UNAVAILABLE");
  }

  if (!success) throw new Error("RATE_LIMIT");
}
