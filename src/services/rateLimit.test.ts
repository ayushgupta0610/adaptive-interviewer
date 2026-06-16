import { describe, it, expect } from "vitest";
import { checkRateLimit, clientIp, enforceRateLimit } from "./rateLimit";

describe("checkRateLimit", () => {
  it("allows up to the limit then blocks within the window", () => {
    const key = `t1-${Math.random()}`;
    const t = 1_000_000;
    expect(checkRateLimit(key, 3, 60_000, t).ok).toBe(true);
    expect(checkRateLimit(key, 3, 60_000, t).ok).toBe(true);
    expect(checkRateLimit(key, 3, 60_000, t).ok).toBe(true);
    const blocked = checkRateLimit(key, 3, 60_000, t);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const key = `t2-${Math.random()}`;
    const t = 2_000_000;
    checkRateLimit(key, 1, 60_000, t);
    expect(checkRateLimit(key, 1, 60_000, t).ok).toBe(false);
    expect(checkRateLimit(key, 1, 60_000, t + 60_001).ok).toBe(true);
  });
});

describe("clientIp", () => {
  const req = (headers: Record<string, string>) => new Request("http://test", { headers });
  it("uses the first entry of x-forwarded-for", () => {
    expect(clientIp(req({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("1.1.1.1");
  });
  it("trims whitespace around the forwarded ip", () => {
    expect(clientIp(req({ "x-forwarded-for": "  3.3.3.3  " }))).toBe("3.3.3.3");
  });
  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    expect(clientIp(req({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
  });
  it("returns 'unknown' when no ip headers are present", () => {
    expect(clientIp(req({}))).toBe("unknown");
  });
});

describe("enforceRateLimit (in-memory fallback — no Upstash configured)", () => {
  it("returns null while under the limit, then a 429 once over", async () => {
    const ip = `5.5.5.${Math.floor(Math.random() * 100000)}`;
    const mk = () => new Request("http://test", { headers: { "x-forwarded-for": ip } });
    expect(await enforceRateLimit(mk(), "test-endpoint", 2)).toBeNull();
    expect(await enforceRateLimit(mk(), "test-endpoint", 2)).toBeNull();
    const blocked = await enforceRateLimit(mk(), "test-endpoint", 2);
    expect(blocked?.status).toBe(429);
  });
});
