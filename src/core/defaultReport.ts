import type { FeedbackReport, InterviewPlan } from "../domain/schemas";

/**
 * Neutral fallback report (spec §8). Returned when scoring fails so the candidate
 * always gets a result instead of a dead-end. The summary is transparent that this
 * is a placeholder — we do not silently fabricate a real evaluation.
 */
export function buildDefaultReport(plan: InterviewPlan): FeedbackReport {
  return {
    perCompetency: plan.competencies.map((c) => ({
      competencyId: c.id,
      score: 3,
      evidence: "Automatic scoring was unavailable; this competency was not individually assessed.",
    })),
    strengths: [],
    gaps: [],
    overall: 3,
    recommendation: "lean-no",
    summary:
      "Automatic scoring was unavailable, so this is a neutral placeholder report. Please retry to get a full evaluation.",
  };
}
