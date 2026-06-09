import { describe, it, expect } from "vitest";
import { createFakeLlm } from "./fakeLlm";
import { InterviewPlanSchema, FeedbackReportSchema, type Guidelines, type InterviewPlan } from "../domain/schemas";
import { buildPlanMessages } from "../core/planPrompt";
import { buildScoreMessages } from "../core/scoringPrompt";
import { extractJson } from "../core/json";

const g: Guidelines = {
  type: "mixed",
  seniority: "mid",
  budget: { kind: "questions", count: 3 },
  focusAreas: [],
};

describe("createFakeLlm", () => {
  it("returns a schema-valid InterviewPlan for the plan prompt", async () => {
    const llm = createFakeLlm();
    const raw = await llm.complete(buildPlanMessages("Some JD text here for testing.", g));
    expect(() => InterviewPlanSchema.parse(extractJson(raw))).not.toThrow();
  });

  it("returns a schema-valid FeedbackReport for the scoring prompt", async () => {
    const plan: InterviewPlan = InterviewPlanSchema.parse(
      extractJson(await createFakeLlm().complete(buildPlanMessages("JD", g))),
    );
    const raw = await createFakeLlm().complete(
      buildScoreMessages(plan, [{ role: "candidate", text: "an answer" }]),
    );
    expect(() => FeedbackReportSchema.parse(extractJson(raw))).not.toThrow();
  });

  it("returns a non-empty follow-up for an interviewer turn", async () => {
    const reply = await createFakeLlm().complete([
      { role: "system", content: "You are a professional interviewer." },
      { role: "user", content: "My answer." },
    ]);
    expect(reply.length).toBeGreaterThan(0);
  });
});
