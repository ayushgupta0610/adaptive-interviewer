import { describe, it, expect, vi } from "vitest";
import { prepareInterview } from "./prepare";
import { createMemoryPlanCache } from "../services/memoryCache";
import type { LlmClient } from "../services/llm";
import type { Guidelines } from "../domain/schemas";

const guidelines: Guidelines = {
  type: "technical",
  seniority: "mid",
  budget: { kind: "questions", count: 3 },
  focusAreas: ["apis"],
};

const validPlanJson = JSON.stringify({
  role: "Backend Engineer",
  competencies: [
    {
      id: "apis",
      label: "API Design",
      weight: 1,
      seedQuestions: ["Design a REST API for a todo app."],
      rubric: { levels: [{ score: 3, descriptor: "reasonable" }], signalsStrong: [], signalsWeak: [] },
    },
  ],
});

function fakeLlm(responses: string[]): LlmClient {
  const queue = [...responses];
  return { complete: vi.fn(async () => queue.shift() ?? "") };
}

describe("prepareInterview", () => {
  it("generates, validates, and caches a plan on a miss", async () => {
    const llm = fakeLlm([validPlanJson]);
    const cache = createMemoryPlanCache();
    const res = await prepareInterview({ jd: "Build APIs", guidelines }, { llm, cache });

    expect(res.cached).toBe(false);
    expect(res.plan.role).toBe("Backend Engineer");
    expect(res.interviewId).toBeTruthy();
  });

  it("returns the cached plan without calling the LLM on a hit", async () => {
    const cache = createMemoryPlanCache();
    const first = await prepareInterview({ jd: "Build APIs", guidelines }, { llm: fakeLlm([validPlanJson]), cache });

    const llm2 = fakeLlm([validPlanJson]);
    const second = await prepareInterview({ jd: "Build APIs", guidelines }, { llm: llm2, cache });

    expect(second.cached).toBe(true);
    expect(second.interviewId).toBe(first.interviewId);
    expect(llm2.complete).not.toHaveBeenCalled();
  });

  it("retries once when the first completion is invalid", async () => {
    const llm = fakeLlm(["not json", validPlanJson]);
    const res = await prepareInterview({ jd: "Build APIs", guidelines }, { llm, cache: createMemoryPlanCache() });
    expect(res.plan.competencies).toHaveLength(1);
    expect(llm.complete).toHaveBeenCalledTimes(2);
  });

  it("still returns a generated plan when the cache is unavailable", async () => {
    const brokenCache = {
      get: async () => {
        throw new Error("table missing");
      },
      put: async () => {
        throw new Error("table missing");
      },
    };
    const res = await prepareInterview({ jd: "Build APIs", guidelines }, { llm: fakeLlm([validPlanJson]), cache: brokenCache });
    expect(res.fallback).toBe(false);
    expect(res.plan.role).toBe("Backend Engineer");
    expect(res.interviewId).toBeTruthy();
  });

  it("falls back to a generic plan when the LLM never returns a valid plan", async () => {
    const llm = fakeLlm(["garbage", "still garbage"]);
    const res = await prepareInterview({ jd: "Build APIs", guidelines }, { llm, cache: createMemoryPlanCache() });
    expect(res.fallback).toBe(true);
    expect(res.plan.competencies.length).toBeGreaterThan(0);
    expect(res.interviewId).toBeTruthy();
  });
});
