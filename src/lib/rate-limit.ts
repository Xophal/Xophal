import { NextRequest } from "next/server";
import { apiRateLimit } from "@/lib/redis";

export async function checkRateLimit(request: NextRequest) {
  if (!apiRateLimit) return;

  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anonymous";

  try {
    const { success } = await apiRateLimit.limit(ip);
    if (!success) throw new Error("RATE_LIMIT");
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT") {
      throw error;
    }
  }
}
