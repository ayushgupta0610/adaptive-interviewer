import { InterviewPlanSchema, type Guidelines, type InterviewPlan } from "../domain/schemas";
import { configHash } from "../domain/hash";
import { buildPlanMessages } from "../core/planPrompt";
import type { LlmClient } from "../services/llm";
import type { PlanCache } from "./ports";
import { completeStructured } from "./completeStructured";

export interface PrepareResult {
  interviewId: string;
  plan: InterviewPlan;
  cached: boolean;
}

/**
 * Turn a JD + guidelines into a cached InterviewPlan. The one slow step; cached by
 * config hash so repeat configs return instantly.
 */
export async function prepareInterview(
  input: { jd: string; guidelines: Guidelines },
  deps: { llm: LlmClient; cache: PlanCache; model?: string },
): Promise<PrepareResult> {
  const hash = configHash(input.jd, input.guidelines);

  const hit = await deps.cache.get(hash);
  if (hit) return { interviewId: hit.interviewId, plan: hit.plan, cached: true };

  const plan = await completeStructured(
    deps.llm,
    buildPlanMessages(input.jd, input.guidelines),
    InterviewPlanSchema,
    { model: deps.model },
  );

  const interviewId = await deps.cache.put({
    configHash: hash,
    jd: input.jd,
    guidelines: input.guidelines,
    plan,
  });
  return { interviewId, plan, cached: false };
}
