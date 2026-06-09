import { describe, it, expect, vi } from "vitest";
import { scoreInterview } from "./score";
import type { LlmClient } from "../services/llm";
import type { InterviewPlan, Transcript } from "../domain/schemas";

const plan: InterviewPlan = {
  role: "Backend Engineer",
  competencies: [
    {
      id: "apis",
      label: "API Design",
      weight: 1,
      seedQuestions: ["Design a REST API."],
      rubric: { levels: [{ score: 3, descriptor: "ok" }], signalsStrong: [], signalsWeak: [] },
    },
  ],
};

const transcript: Transcript = [
  { role: "interviewer", text: "Design a REST API." },
  { role: "candidate", text: "I'd use resources and proper verbs." },
];

const validReportJson = JSON.stringify({
  perCompetency: [{ competencyId: "apis", score: 4, evidence: "Used REST verbs correctly." }],
  strengths: ["clear"],
  gaps: [],
  overall: 4,
  recommendation: "yes",
  summary: "Strong on API design.",
});

function fakeLlm(responses: string[]): LlmClient {
  const queue = [...responses];
  return { complete: vi.fn(async () => queue.shift() ?? "") };
}

describe("scoreInterview", () => {
  it("returns a validated FeedbackReport", async () => {
    const report = await scoreInterview({ plan, transcript }, { llm: fakeLlm([validReportJson]) });
    expect(report.overall).toBe(4);
    expect(report.recommendation).toBe("yes");
  });

  it("retries once on invalid output", async () => {
    const llm = fakeLlm(["oops", validReportJson]);
    const report = await scoreInterview({ plan, transcript }, { llm });
    expect(report.perCompetency[0].competencyId).toBe("apis");
    expect(llm.complete).toHaveBeenCalledTimes(2);
  });

  it("returns a transparent fallback report when output never validates", async () => {
    const report = await scoreInterview({ plan, transcript }, { llm: fakeLlm(["nope", "nope"]) });
    expect(report.recommendation).toBe("lean-no");
    expect(report.summary.toLowerCase()).toContain("unavailable");
    expect(report.perCompetency[0].competencyId).toBe("apis");
  });
});
