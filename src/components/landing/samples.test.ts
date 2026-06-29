import { describe, it, expect } from "vitest";
import { ROLE_SAMPLES } from "./samples";

describe("ROLE_SAMPLES", () => {
  it("has at least 4 roles with unique ids", () => {
    expect(ROLE_SAMPLES.length).toBeGreaterThanOrEqual(4);
    const ids = ROLE_SAMPLES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("each role has 3 competencies (0–5) and a strength + gap note", () => {
    for (const r of ROLE_SAMPLES) {
      expect(r.competencies).toHaveLength(3);
      for (const c of r.competencies) {
        expect(c.score).toBeGreaterThanOrEqual(0);
        expect(c.score).toBeLessThanOrEqual(5);
      }
      expect(r.strength.length).toBeGreaterThan(0);
      expect(r.gap.length).toBeGreaterThan(0);
    }
  });
});
