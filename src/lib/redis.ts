import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { serverEnv } from "@/lib/env.server";

const { UPSTASH_REDIS_REST_TOKEN: token, UPSTASH_REDIS_REST_URL: url } = serverEnv;
const redis = url && token ? new Redis({ url, token }) : null;

function createRateLimit(limit: number, window: `${number} ${"m" | "h"}`, prefix: string) {
  if (!redis) return null;

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: true,
    prefix,
  });
}

export const apiRateLimit = createRateLimit(60, "1 m", "xophal:api");

export const authRateLimit = createRateLimit(10, "1 m", "xophal:auth");

export const aiRateLimit = createRateLimit(20, "1 h", "xophal:ai");

export { redis };

export async function getCached<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    return await redis.get<T>(key);
  } catch {
    return null;
  }
}

export async function setCache<T>(key: string, value: T, ttlSeconds = 3600): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {
    // Cache miss is acceptable
  }
}

export async function invalidateCache(pattern: string): Promise<void> {
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Ignore cache invalidation errors
  }
}
