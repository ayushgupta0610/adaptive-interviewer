import { describe, it, expect } from "vitest";
import {
  GuidelinesSchema,
  InterviewPlanSchema,
  FeedbackReportSchema,
  type InterviewPlan,
} from "./schemas";

const validGuidelines = {
  type: "behavioral",
  seniority: "senior",
  budget: { kind: "questions", count: 5 },
  focusAreas: ["ownership", "system design"],
};

const validPlan: InterviewPlan = {
  role: "Senior Backend Engineer",
  competencies: [
    {
      id: "system-design",
      label: "System Design",
      weight: 2,
      seedQuestions: ["Design a URL shortener."],
      rubric: {
        levels: [
          { score: 1, descriptor: "No structure" },
          { score: 5, descriptor: "Clear, scalable, justified tradeoffs" },
        ],
        signalsStrong: ["discusses tradeoffs"],
        signalsWeak: ["ignores scale"],
      },
    },
  ],
};

const validReport = {
  perCompetency: [{ competencyId: "system-design", score: 4, evidence: "Covered sharding." }],
  strengths: ["clear communicator"],
  gaps: ["weak on caching"],
  overall: 4,
  recommendation: "lean-yes",
  summary: "Solid senior candidate with a caching gap.",
};

describe("GuidelinesSchema", () => {
  it("accepts a valid guidelines object", () => {
    expect(GuidelinesSchema.parse(validGuidelines).type).toBe("behavioral");
  });

  it("defaults focusAreas to []", () => {
    const { focusAreas, ...rest } = validGuidelines;
    expect(GuidelinesSchema.parse(rest).focusAreas).toEqual([]);
  });

  it("accepts the minutes budget variant", () => {
    const g = GuidelinesSchema.parse({ ...validGuidelines, budget: { kind: "minutes", minutes: 30 } });
    expect(g.budget).toEqual({ kind: "minutes", minutes: 30 });
  });

  it("rejects an unknown interview type", () => {
    expect(GuidelinesSchema.safeParse({ ...validGuidelines, type: "vibes" }).success).toBe(false);
  });

  it("rejects a zero-count question budget", () => {
    expect(
      GuidelinesSchema.safeParse({ ...validGuidelines, budget: { kind: "questions", count: 0 } }).success,
    ).toBe(false);
  });
});

describe("InterviewPlanSchema", () => {
  it("accepts a valid plan", () => {
    expect(InterviewPlanSchema.parse(validPlan).competencies).toHaveLength(1);
  });

  it("rejects a plan with no competencies", () => {
    expect(InterviewPlanSchema.safeParse({ ...validPlan, competencies: [] }).success).toBe(false);
  });

  it("rejects a competency with no seed questions", () => {
    const bad = { ...validPlan, competencies: [{ ...validPlan.competencies[0], seedQuestions: [] }] };
    expect(InterviewPlanSchema.safeParse(bad).success).toBe(false);
  });
});

describe("FeedbackReportSchema", () => {
  it("accepts a valid report", () => {
    expect(FeedbackReportSchema.parse(validReport).recommendation).toBe("lean-yes");
  });

  it("rejects a per-competency score above 5", () => {
    const bad = { ...validReport, perCompetency: [{ competencyId: "x", score: 6, evidence: "" }] };
    expect(FeedbackReportSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an unknown recommendation", () => {
    expect(FeedbackReportSchema.safeParse({ ...validReport, recommendation: "maybe" }).success).toBe(false);
  });
});
