import { describe, it, expect } from "vitest";
import { buildDefaultReport } from "./defaultReport";
import { FeedbackReportSchema, type InterviewPlan } from "../domain/schemas";

const plan: InterviewPlan = {
  role: "mid role",
  competencies: [
    { id: "a", label: "A", weight: 1, seedQuestions: ["q"], rubric: { levels: [{ score: 3, descriptor: "ok" }], signalsStrong: [], signalsWeak: [] } },
    { id: "b", label: "B", weight: 1, seedQuestions: ["q"], rubric: { levels: [{ score: 3, descriptor: "ok" }], signalsStrong: [], signalsWeak: [] } },
  ],
};

describe("buildDefaultReport", () => {
  it("is schema-valid with one entry per competency", () => {
    const report = buildDefaultReport(plan);
    expect(() => FeedbackReportSchema.parse(report)).not.toThrow();
    expect(report.perCompetency.map((c) => c.competencyId)).toEqual(["a", "b"]);
  });

  it("is transparent that scoring was unavailable", () => {
    expect(buildDefaultReport(plan).summary.toLowerCase()).toContain("unavailable");
  });
});
