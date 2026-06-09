import type { Guidelines, InterviewPlan, Competency } from "../domain/schemas";

/**
 * Generic, role-type-appropriate fallback plan (spec §8). Used when plan
 * generation fails so an interview can still run rather than dead-ending.
 */
const SETS: Record<Guidelines["type"], { id: string; label: string; weight: number; seed: string }[]> = {
  behavioral: [
    { id: "ownership", label: "Ownership & Impact", weight: 2, seed: "Tell me about a project you drove end to end and the impact it had." },
    { id: "collaboration", label: "Collaboration", weight: 1, seed: "Describe a disagreement with a teammate and how you resolved it." },
    { id: "communication", label: "Communication", weight: 1, seed: "Explain a hard decision you made to a non-technical audience." },
  ],
  technical: [
    { id: "core-technical", label: "Core Technical Skills", weight: 2, seed: "Walk me through a technically challenging problem you solved." },
    { id: "problem-solving", label: "Problem Solving", weight: 2, seed: "How do you approach debugging an unfamiliar system?" },
    { id: "communication", label: "Communication", weight: 1, seed: "Explain a recent technical tradeoff you made." },
  ],
  "system-design": [
    { id: "system-design", label: "System Design", weight: 3, seed: "Design a URL shortener and walk me through it." },
    { id: "scalability", label: "Scalability", weight: 2, seed: "How would you scale that to a billion requests a day?" },
    { id: "tradeoffs", label: "Tradeoffs", weight: 1, seed: "What tradeoffs did you make, and why?" },
  ],
  mixed: [
    { id: "core-technical", label: "Core Technical Skills", weight: 2, seed: "Walk me through a technically challenging project." },
    { id: "problem-solving", label: "Problem Solving", weight: 2, seed: "Tell me about a hard bug you tracked down." },
    { id: "communication", label: "Communication", weight: 1, seed: "Explain a complex concept as simply as you can." },
  ],
};

export function buildDefaultPlan(g: Guidelines): InterviewPlan {
  const competencies: Competency[] = SETS[g.type].map((c) => ({
    id: c.id,
    label: c.label,
    weight: c.weight,
    seedQuestions: [c.seed],
    rubric: {
      levels: [
        { score: 1, descriptor: "little or no evidence" },
        { score: 3, descriptor: "adequate, somewhat shallow" },
        { score: 5, descriptor: "excellent — specific, owns tradeoffs" },
      ],
      signalsStrong: ["specific examples", "clear reasoning"],
      signalsWeak: ["vague answers", "no ownership"],
    },
  }));
  return { role: `${g.seniority} role`, competencies };
}
