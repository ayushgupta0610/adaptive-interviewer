import { describe, it, expect } from "vitest";
import { prepareInterview } from "./prepare";
import { interviewerTurn } from "./turn";
import { scoreInterview } from "./score";
import { createMemoryPlanCache } from "../services/memoryCache";
import { buildInterviewerSession } from "../core/sessionConfig";
import type { LlmClient } from "../services/llm";
import type { ChatMessage } from "../core/chat";
import type { Guidelines, Transcript } from "../domain/schemas";

/**
 * Full adaptive-loop composition with a scripted fake LLM: prepare → several
 * interviewer turns → score. Proves the three units wire together end-to-end
 * (the same path the HTTP routes drive), without any live service.
 */

const planJson = JSON.stringify({
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
          { score: 5, descriptor: "scalable, tradeoffs" },
        ],
        signalsStrong: ["mentions tradeoffs"],
        signalsWeak: ["ignores scale"],
      },
    },
  ],
});

const reportJson = JSON.stringify({
  perCompetency: [{ competencyId: "system-design", score: 4, evidence: "Proposed a token bucket." }],
  strengths: ["clear reasoning"],
  gaps: ["didn't discuss failure modes"],
  overall: 4,
  recommendation: "yes",
  summary: "Strong system-design fundamentals.",
});

// Scripted interviewer turns (would normally be adaptive LLM output).
const turns = ["Great. How would you handle bursts of traffic?", "And how would you persist the counters?"];

function scriptedLlm(): LlmClient {
  let turnIdx = 0;
  return {
    async complete(messages: ChatMessage[]) {
      const system = messages[0]?.content ?? "";
      if (system.includes("INTERVIEW PLAN")) return planJson; // plan-gen prompt
      if (system.includes("evaluator")) return reportJson; // scoring prompt
      return turns[turnIdx++] ?? "Thanks, that's all my questions."; // interviewer turn
    },
  };
}

const guidelines: Guidelines = {
  type: "system-design",
  seniority: "senior",
  budget: { kind: "questions", count: 2 },
  focusAreas: ["scalability"],
};

describe("full interview flow", () => {
  it("prepares a plan, runs adaptive turns, and scores the transcript", async () => {
    const llm = scriptedLlm();

    // 1. prepare
    const prep = await prepareInterview({ jd: "Build scalable payment systems.", guidelines }, { llm, cache: createMemoryPlanCache() });
    expect(prep.plan.role).toBe("Senior Backend Engineer");

    // 2. run a few interviewer turns (text-mode loop)
    const session = buildInterviewerSession(prep.plan, guidelines);
    const messages: ChatMessage[] = [{ role: "assistant", content: session.firstMessage }];
    for (const answer of ["I'd use a token bucket in Redis.", "Shard counters by user id."]) {
      messages.push({ role: "user", content: answer });
      const reply = await interviewerTurn({ systemPrompt: session.systemPrompt, messages }, { llm });
      expect(reply.length).toBeGreaterThan(0);
      messages.push({ role: "assistant", content: reply });
    }

    // 3. score the resulting transcript
    const transcript: Transcript = messages.map((m) => ({
      role: m.role === "assistant" ? "interviewer" : "candidate",
      text: m.content,
    }));
    const report = await scoreInterview({ plan: prep.plan, transcript }, { llm });

    expect(report.overall).toBe(4);
    expect(report.recommendation).toBe("yes");
    expect(report.perCompetency[0].competencyId).toBe("system-design");
  });
});
