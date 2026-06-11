import { randomUUID } from "node:crypto";
import { InterviewPlanSchema, type Guidelines, type InterviewPlan } from "../domain/schemas";
import { configHash } from "../domain/hash";
import { buildPlanMessages } from "../core/planPrompt";
import { buildDefaultPlan } from "../core/defaultPlan";
import type { LlmClient } from "../services/llm";
import type { PlanCache } from "./ports";
import { completeStructured } from "./completeStructured";

export interface PrepareResult {
  interviewId: string;
  plan: InterviewPlan;
  cached: boolean;
  /** True when plan generation failed and a generic fallback plan is used (spec §8). */
  fallback: boolean;
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

  // Cache is a best-effort optimization — a persistence outage must never break an
  // interview, so cache reads/writes are guarded.
  let hit = null;
  try {
    hit = await deps.cache.get(hash);
  } catch {
    hit = null;
  }
  if (hit) return { interviewId: hit.interviewId, plan: hit.plan, cached: true, fallback: false };

  let plan: InterviewPlan;
  try {
    plan = await completeStructured(
      deps.llm,
      buildPlanMessages(input.jd, input.guidelines),
      InterviewPlanSchema,
      { model: deps.model },
    );
  } catch {
    // Plan generation failed — fall back to a generic plan so the interview can still
    // run. Store it under a unique hash (not the real config hash) so it's retrievable
    // by id (for /turn) without poisoning the cache slot for a later real generation.
    const fallbackPlan = buildDefaultPlan(input.guidelines);
    let interviewId: string;
    try {
      interviewId = await deps.cache.put({
        configHash: randomUUID(),
        jd: input.jd,
        guidelines: input.guidelines,
        plan: fallbackPlan,
      });
    } catch {
      interviewId = randomUUID();
    }
    return { interviewId, plan: fallbackPlan, cached: false, fallback: true };
  }

  let interviewId: string;
  try {
    interviewId = await deps.cache.put({
      configHash: hash,
      jd: input.jd,
      guidelines: input.guidelines,
      plan,
    });
  } catch {
    // Persistence failed (e.g. table missing) — proceed with an ephemeral id.
    interviewId = randomUUID();
  }
  return { interviewId, plan, cached: false, fallback: false };
}
