import { describe, it, expect } from "vitest";
import { configHash } from "./hash";
import type { Guidelines } from "./schemas";

const g: Guidelines = {
  type: "technical",
  seniority: "mid",
  budget: { kind: "questions", count: 6 },
  focusAreas: ["apis", "testing"],
};

describe("configHash", () => {
  it("is stable for identical inputs", () => {
    expect(configHash("Build great APIs", g)).toBe(configHash("Build great APIs", g));
  });

  it("ignores focusAreas ordering and casing/whitespace", () => {
    const reordered: Guidelines = { ...g, focusAreas: [" Testing ", "APIs"] };
    expect(configHash("Build great APIs", g)).toBe(configHash("Build great APIs", reordered));
  });

  it("changes when the JD changes", () => {
    expect(configHash("JD one", g)).not.toBe(configHash("JD two", g));
  });

  it("changes when a guideline changes", () => {
    expect(configHash("JD", g)).not.toBe(configHash("JD", { ...g, seniority: "staff+" }));
  });
});
