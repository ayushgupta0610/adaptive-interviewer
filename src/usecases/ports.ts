import type { Guidelines, InterviewPlan } from "../domain/schemas";

export interface CachedPlan {
  interviewId: string;
  plan: InterviewPlan;
}

/** Port: where prepared Interview Plans are cached (Supabase in prod, in-memory in dev/tests). */
export interface PlanCache {
  get(configHash: string): Promise<CachedPlan | null>;
  put(input: {
    configHash: string;
    jd: string;
    guidelines: Guidelines;
    plan: InterviewPlan;
  }): Promise<string>;
}
