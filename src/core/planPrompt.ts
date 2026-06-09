import type { ChatMessage } from "./chat";
import type { Guidelines } from "../domain/schemas";

function budgetLine(g: Guidelines): string {
  return g.budget.kind === "questions"
    ? `about ${g.budget.count} primary questions`
    : `about ${g.budget.minutes} minutes of conversation`;
}

/**
 * Build the LLM prompt that turns a JD + guidelines into an InterviewPlan.
 * Pure: no network. The output is validated against InterviewPlanSchema by the caller.
 */
export function buildPlanMessages(jd: string, g: Guidelines): ChatMessage[] {
  const system = [
    "You are an expert technical interviewer and hiring assistant.",
    "Given a job description and interview guidelines, produce an INTERVIEW PLAN.",
    "Respond with STRICT JSON only — no markdown fences, no commentary — matching exactly this shape:",
    "{",
    '  "role": string,                    // role title inferred from the JD',
    '  "competencies": [                  // 2-6 items, sized to the question budget',
    "    {",
    '      "id": string,                  // kebab-case stable id',
    '      "label": string,',
    '      "weight": number,              // relative importance, >= 0',
    '      "seedQuestions": [string],     // 1-3 opening questions, answerable aloud',
    '      "rubric": {',
    '        "levels": [ { "score": 1..5, "descriptor": string } ],',
    '        "signalsStrong": [string],',
    '        "signalsWeak": [string]',
    "      }",
    "    }",
    "  ]",
    "}",
    "Cover the role's core skills and the requested focus areas. Match depth to the seniority.",
  ].join("\n");

  const user = [
    `INTERVIEW TYPE: ${g.type}`,
    `SENIORITY: ${g.seniority}`,
    `BUDGET: ${budgetLine(g)}`,
    `FOCUS AREAS: ${g.focusAreas.length ? g.focusAreas.join(", ") : "(none specified — infer from the JD)"}`,
    "",
    "JOB DESCRIPTION:",
    jd.trim(),
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
