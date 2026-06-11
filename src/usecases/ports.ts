import type { Guidelines, InterviewPlan } from "../domain/schemas";

export interface CachedPlan {
  interviewId: string;
  plan: InterviewPlan;
}

/** Plan + the guidelines it was built from — enough to rebuild the interviewer prompt server-side. */
export interface InterviewSource {
  plan: InterviewPlan;
  guidelines: Guidelines;
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
  /** Look up an interview by its id — used to rebuild the system prompt server-side (so the
   *  client never supplies it). */
  getById(interviewId: string): Promise<InterviewSource | null>;
}
