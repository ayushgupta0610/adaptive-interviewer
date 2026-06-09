import { describe, it, expect } from "vitest";
import { buildDefaultPlan } from "./defaultPlan";
import { InterviewPlanSchema, type Guidelines } from "../domain/schemas";

const base: Guidelines = {
  type: "technical",
  seniority: "senior",
  budget: { kind: "questions", count: 3 },
  focusAreas: [],
};

describe("buildDefaultPlan", () => {
  it("produces a schema-valid plan for every interview type", () => {
    for (const type of ["behavioral", "technical", "system-design", "mixed"] as const) {
      const plan = buildDefaultPlan({ ...base, type });
      expect(() => InterviewPlanSchema.parse(plan)).not.toThrow();
      expect(plan.competencies.length).toBeGreaterThan(0);
    }
  });

  it("reflects the seniority in the role", () => {
    expect(buildDefaultPlan({ ...base, seniority: "staff+" }).role).toContain("staff+");
  });
});
