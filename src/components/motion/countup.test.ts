import { describe, it, expect } from "vitest";
import { easeOutValue } from "./countup";

describe("easeOutValue", () => {
  it("is 0 at t=0 and the target at t=1", () => {
    expect(easeOutValue(0, 5)).toBe(0);
    expect(easeOutValue(1, 5)).toBe(5);
  });
  it("clamps out-of-range progress", () => {
    expect(easeOutValue(-1, 5)).toBe(0);
    expect(easeOutValue(2, 5)).toBe(5);
  });
  it("eases out — past the linear midpoint at t=0.5", () => {
    expect(easeOutValue(0.5, 10)).toBeGreaterThan(5);
  });
});
