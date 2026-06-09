import { describe, it, expect } from "vitest";
import { buildScoreMessages } from "./scoringPrompt";
import type { InterviewPlan, Transcript } from "../domain/schemas";

const plan: InterviewPlan = {
  role: "Senior Backend Engineer",
  competencies: [
    {
      id: "system-design",
      label: "System Design",
      weight: 2,
      seedQuestions: ["Design a rate limiter."],
      rubric: {
        levels: [
          { score: 1, descriptor: "no structure" },
          { score: 5, descriptor: "scalable + tradeoffs" },
        ],
        signalsStrong: ["mentions tradeoffs"],
        signalsWeak: ["ignores scale"],
      },
    },
  ],
};

const transcript: Transcript = [
  { role: "interviewer", text: "Design a rate limiter." },
  { role: "candidate", text: "I'd use a token bucket in Redis." },
];

describe("buildScoreMessages", () => {
  const msgs = buildScoreMessages(plan, transcript);

  it("returns a system then a user message", () => {
    expect(msgs.map((m) => m.role)).toEqual(["system", "user"]);
  });

  it("asks for a FeedbackReport JSON with the recommendation enum", () => {
    const sys = msgs[0].content.toLowerCase();
    expect(sys).toContain("json");
    expect(sys).toContain("recommendation");
    expect(sys).toContain("strong-yes");
  });

  it("embeds the rubric (competency id + levels) and the transcript", () => {
    const user = msgs[1].content;
    expect(user).toContain("system-design");
    expect(user).toContain("token bucket");
    expect(user).toContain("Candidate:");
  });
});
