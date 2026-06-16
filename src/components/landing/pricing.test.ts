import { describe, it, expect } from "vitest";
import { TIERS } from "./pricing";

describe("pricing TIERS", () => {
  it("has Free, Plus (starter), Pro (pro)", () => {
    expect(TIERS.map((t) => t.id)).toEqual(["free", "starter", "pro"]);
  });
  it("only paid tiers carry a checkout id matching the API enum", () => {
    const paid = TIERS.filter((t) => t.checkoutId);
    expect(paid.map((t) => t.checkoutId)).toEqual(["starter", "pro"]);
    expect(TIERS.find((t) => t.id === "free")?.checkoutId).toBeUndefined();
  });
  it("prices match the repriced plan (₹299 / ₹699)", () => {
    expect(TIERS.find((t) => t.id === "starter")?.priceInr).toBe(299);
    expect(TIERS.find((t) => t.id === "pro")?.priceInr).toBe(699);
  });
});
