import type { LlmClient } from "./llm";
import type { ChatMessage } from "../core/chat";

/**
 * Deterministic stub LLM for keyless local dev / offline demo / E2E. Enabled with
 * FAKE_LLM=1. It inspects the prompt's system message (same discriminators the real
 * prompts use) and returns schema-valid output: an InterviewPlan for plan-gen, a
 * FeedbackReport for scoring, and a plausible adaptive follow-up otherwise.
 */
const FAKE_PLAN = {
  role: "Software Engineer (stub)",
  competencies: [
    {
      id: "core-technical",
      label: "Core Technical Skills",
      weight: 2,
      seedQuestions: ["Walk me through a technically challenging project you owned end to end."],
      rubric: {
        levels: [
          { score: 1, descriptor: "vague, no technical depth" },
          { score: 3, descriptor: "solid but shallow on tradeoffs" },
          { score: 5, descriptor: "deep, justifies decisions, owns tradeoffs" },
        ],
        signalsStrong: ["explains tradeoffs", "quantifies impact"],
        signalsWeak: ["hand-waves details", "no ownership"],
      },
    },
    {
      id: "problem-solving",
      label: "Problem Solving",
      weight: 2,
      seedQuestions: ["Tell me about a time you debugged something that initially made no sense."],
      rubric: {
        levels: [
          { score: 1, descriptor: "no structured approach" },
          { score: 3, descriptor: "reasonable approach, some gaps" },
          { score: 5, descriptor: "systematic, hypothesis-driven, learns from it" },
        ],
        signalsStrong: ["forms hypotheses", "isolates variables"],
        signalsWeak: ["guesses randomly", "gives up"],
      },
    },
    {
      id: "communication",
      label: "Communication",
      weight: 1,
      seedQuestions: ["Explain a complex technical concept as you would to a non-technical stakeholder."],
      rubric: {
        levels: [
          { score: 1, descriptor: "jargon-heavy, unclear" },
          { score: 3, descriptor: "mostly clear" },
          { score: 5, descriptor: "clear, audience-aware, concise" },
        ],
        signalsStrong: ["adapts to audience", "uses analogies"],
        signalsWeak: ["overloads jargon", "rambles"],
      },
    },
  ],
};

const FAKE_REPORT = {
  perCompetency: [
    { competencyId: "core-technical", score: 4, evidence: "Described a real project with some tradeoff discussion." },
    { competencyId: "problem-solving", score: 3, evidence: "Reasonable debugging approach, lacked hypothesis framing." },
    { competencyId: "communication", score: 4, evidence: "Clear explanation with a helpful analogy." },
  ],
  strengths: ["Concrete examples", "Clear communication"],
  gaps: ["Could be more systematic when debugging"],
  overall: 3.7,
  recommendation: "lean-yes",
  summary: "Stub feedback: a capable candidate with solid fundamentals and a minor gap in structured problem-solving.",
};

const FOLLOWUPS = [
  "Interesting — what was the hardest tradeoff you had to make there, and why?",
  "Got it. If you had to do that again at 10x the scale, what would you change?",
  "Thanks. Can you walk me through how you validated that your solution actually worked?",
  "That makes sense. Where did this approach fall short, and how did you handle it?",
  "Understood. Let's switch gears — tell me about a time you disagreed with a teammate on a technical decision.",
];

export function createFakeLlm(): LlmClient {
  let turn = 0;
  return {
    async complete(messages: ChatMessage[]) {
      const system = messages[0]?.content ?? "";
      if (system.includes("INTERVIEW PLAN")) return JSON.stringify(FAKE_PLAN);
      if (system.includes("evaluator")) return JSON.stringify(FAKE_REPORT);
      return FOLLOWUPS[turn++ % FOLLOWUPS.length];
    },
  };
}
