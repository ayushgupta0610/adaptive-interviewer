/**
 * Minimal in-memory fixed-window rate limiter. First line of defense against abuse /
 * cost-runaway on expensive endpoints.
 *
 * NOTE: in-memory = per server instance, so it does NOT hold across serverless
 * instances. For production, back this with a shared store (e.g. Upstash Redis).
 */
import { durableCheck } from "./redisRateLimit";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): { ok: boolean; retryAfter: number } {
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}

export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Returns a 429 Response if the caller is over the limit, else null. */
export async function enforceRateLimit(
  request: Request,
  name: string,
  limit: number,
  windowMs = 60_000,
): Promise<Response | null> {
  const id = clientIp(request);
  const durable = await durableCheck(name, id, limit, Math.round(windowMs / 1000));
  const ok = durable === null ? checkRateLimit(`${name}:${id}`, limit, windowMs).ok : durable;
  if (ok) return null;
  return Response.json(
    { error: "Too many requests — please slow down." },
    { status: 429 },
  );
}
