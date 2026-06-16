import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env, hasUpstash } from "./env";

const limiters = new Map<string, Ratelimit>();

function limiter(name: string, limit: number, windowSec: number): Ratelimit | null {
  if (!hasUpstash) return null;
  const key = `${name}:${limit}:${windowSec}`;
  if (!limiters.has(key)) {
    limiters.set(
      key,
      new Ratelimit({
        redis: new Redis({ url: env.UPSTASH_REDIS_REST_URL!, token: env.UPSTASH_REDIS_REST_TOKEN! }),
        limiter: Ratelimit.fixedWindow(limit, `${windowSec} s`),
        prefix: `rl:${name}`,
      }),
    );
  }
  return limiters.get(key)!;
}

/**
 * Check the durable Upstash rate limiter.
 * Returns null if Upstash is not configured (caller should fall back to in-memory).
 */
export async function durableCheck(
  name: string,
  id: string,
  limit: number,
  windowSec = 60,
): Promise<boolean | null> {
  const l = limiter(name, limit, windowSec);
  if (!l) return null;
  const { success } = await l.limit(id);
  return success;
}
