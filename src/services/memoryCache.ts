import { randomUUID } from "node:crypto";
import type { PlanCache, CachedPlan, InterviewSource } from "../usecases/ports";

/**
 * In-memory PlanCache. Used in tests and as a zero-config fallback so prepare()/
 * score() work locally before Supabase keys are wired in. Not durable across restarts.
 */
export function createMemoryPlanCache(): PlanCache {
  const byHash = new Map<string, CachedPlan>();
  const byId = new Map<string, InterviewSource>();
  return {
    async get(hash) {
      return byHash.get(hash) ?? null;
    },
    async put({ configHash, plan, guidelines }) {
      const interviewId = randomUUID();
      byHash.set(configHash, { interviewId, plan });
      byId.set(interviewId, { plan, guidelines });
      return interviewId;
    },
    async getById(interviewId) {
      return byId.get(interviewId) ?? null;
    },
  };
}
