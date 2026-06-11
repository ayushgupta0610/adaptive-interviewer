import { describe, it, expect } from "vitest";
import { checkRateLimit } from "./rateLimit";

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
