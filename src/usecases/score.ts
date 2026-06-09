import { FeedbackReportSchema, type FeedbackReport, type InterviewPlan, type Transcript } from "../domain/schemas";
import { buildScoreMessages } from "../core/scoringPrompt";
import { buildDefaultReport } from "../core/defaultReport";
import type { LlmClient } from "../services/llm";
import { completeStructured } from "./completeStructured";

/**
 * Grade a finished interview's transcript against its plan rubric into a
 * FeedbackReport. Post-call only — no real-time constraint. On scoring failure,
 * returns a transparent neutral fallback report rather than dead-ending (spec §8).
 */
export async function scoreInterview(
  input: { plan: InterviewPlan; transcript: Transcript },
  deps: { llm: LlmClient; model?: string },
): Promise<FeedbackReport> {
  try {
    return await completeStructured(
      deps.llm,
      buildScoreMessages(input.plan, input.transcript),
      FeedbackReportSchema,
      { model: deps.model },
    );
  } catch {
    return buildDefaultReport(input.plan);
  }
}
