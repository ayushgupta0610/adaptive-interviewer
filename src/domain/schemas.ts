import { z } from "zod";

/**
 * Domain schemas — the single source of truth for the shapes that flow between
 * the interview's three units (prepare / runtime / score). All external data
 * (LLM output, request bodies) is validated against these at the boundary.
 */

export const GuidelinesSchema = z.object({
  type: z.enum(["behavioral", "technical", "system-design", "mixed"]),
  seniority: z.enum(["intern", "junior", "mid", "senior", "staff+"]),
  budget: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("questions"), count: z.number().int().min(1).max(50) }),
    z.object({ kind: z.literal("minutes"), minutes: z.number().int().min(5).max(180) }),
  ]),
  focusAreas: z.array(z.string().min(1)).max(20).default([]),
});

export const RubricLevelSchema = z.object({
  score: z.number().int().min(1).max(5),
  descriptor: z.string().min(1),
});

export const CompetencySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  weight: z.number().min(0),
  seedQuestions: z.array(z.string().min(1)).min(1),
  rubric: z.object({
    levels: z.array(RubricLevelSchema).min(1),
    signalsStrong: z.array(z.string()).default([]),
    signalsWeak: z.array(z.string()).default([]),
  }),
});

export const InterviewPlanSchema = z.object({
  role: z.string().min(1),
  competencies: z.array(CompetencySchema).min(1),
});

export const FeedbackReportSchema = z.object({
  perCompetency: z
    .array(
      z.object({
        competencyId: z.string().min(1),
        score: z.number().int().min(1).max(5),
        evidence: z.string(),
      }),
    )
    .min(1),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  overall: z.number().min(1).max(5),
  recommendation: z.enum(["strong-no", "no", "lean-no", "lean-yes", "yes", "strong-yes"]),
  summary: z.string().min(1),
});

export const TranscriptTurnSchema = z.object({
  role: z.enum(["interviewer", "candidate"]),
  text: z.string(),
});
export const TranscriptSchema = z.array(TranscriptTurnSchema);

export type TranscriptTurn = z.infer<typeof TranscriptTurnSchema>;
export type Transcript = z.infer<typeof TranscriptSchema>;

export type Guidelines = z.infer<typeof GuidelinesSchema>;
export type RubricLevel = z.infer<typeof RubricLevelSchema>;
export type Competency = z.infer<typeof CompetencySchema>;
export type InterviewPlan = z.infer<typeof InterviewPlanSchema>;
export type FeedbackReport = z.infer<typeof FeedbackReportSchema>;
