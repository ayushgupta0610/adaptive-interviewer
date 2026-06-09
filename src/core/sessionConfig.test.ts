import { describe, it, expect } from "vitest";
import { buildInterviewerSession } from "./sessionConfig";
import type { Guidelines, InterviewPlan } from "../domain/schemas";

const plan: InterviewPlan = {
  role: "Staff Frontend Engineer",
  competencies: [
    {
      id: "react",
      label: "React Architecture",
      weight: 2,
      seedQuestions: ["How do you manage shared state?"],
      rubric: { levels: [{ score: 3, descriptor: "ok" }], signalsStrong: [], signalsWeak: [] },
    },
    {
      id: "comms",
      label: "Communication",
      weight: 1,
      seedQuestions: ["Explain hydration to a PM."],
      rubric: { levels: [{ score: 3, descriptor: "ok" }], signalsStrong: [], signalsWeak: [] },
    },
  ],
};

const g: Guidelines = {
  type: "mixed",
  seniority: "staff+",
  budget: { kind: "minutes", minutes: 30 },
  focusAreas: [],
};

describe("buildInterviewerSession", () => {
  const s = buildInterviewerSession(plan, g);

  it("produces a non-empty opening line and system prompt", () => {
    expect(s.firstMessage.length).toBeGreaterThan(0);
    expect(s.systemPrompt.length).toBeGreaterThan(0);
  });

  it("embeds the role and every competency label", () => {
    expect(s.systemPrompt).toContain("Staff Frontend Engineer");
    expect(s.systemPrompt).toContain("React Architecture");
    expect(s.systemPrompt).toContain("Communication");
  });

  it("encodes the adaptivity rules and the budget", () => {
    const p = s.systemPrompt.toLowerCase();
    expect(p).toContain("one question at a time");
    expect(p).toContain("follow-up"); // probing deeper
    expect(p).toContain("30 minutes");
  });
});
