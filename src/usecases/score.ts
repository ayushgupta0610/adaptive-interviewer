import { FeedbackReportSchema, type FeedbackReport, type InterviewPlan, type Transcript } from "../domain/schemas";
import { buildScoreMessages } from "../core/scoringPrompt";
import type { LlmClient } from "../services/llm";
import { completeStructured } from "./completeStructured";

/**
 * Grade a finished interview's transcript against its plan rubric into a
 * FeedbackReport. Post-call only — no real-time constraint.
 */
export async function scoreInterview(
  input: { plan: InterviewPlan; transcript: Transcript },
  deps: { llm: LlmClient; model?: string },
): Promise<FeedbackReport> {
  return completeStructured(
    deps.llm,
    buildScoreMessages(input.plan, input.transcript),
    FeedbackReportSchema,
    { model: deps.model },
  );
}
