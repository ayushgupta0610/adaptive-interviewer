import { describe, it, expect } from "vitest";
import { estimateSessionCost, priceForMargin } from "./cost";

describe("estimateSessionCost", () => {
  it("text-only session is essentially just LLM cost (no per-minute charges)", () => {
    const c = estimateSessionCost({ minutes: 10, voice: false, avatar: false, llmInputTokens: 30_000, llmOutputTokens: 4_000 });
    expect(c.voice).toBe(0);
    expect(c.avatar).toBe(0);
    // 30k*$1/M + 4k*$5/M = 0.03 + 0.02 = 0.05
    expect(c.llm).toBeCloseTo(0.05, 4);
    expect(c.total).toBeCloseTo(0.05, 4);
  });

  it("voice session adds ~$0.10/min", () => {
    const c = estimateSessionCost({ minutes: 10, voice: true, avatar: false, llmInputTokens: 60_000, llmOutputTokens: 6_000 });
    expect(c.voice).toBeCloseTo(1.0, 4);
    expect(c.avatar).toBe(0);
    expect(c.total).toBeCloseTo(1.0 + 0.06 + 0.03, 4); // voice + llm(0.06+0.03)
  });

  it("voice + avatar 10-min session is ~$1.59", () => {
    const c = estimateSessionCost({ minutes: 10, voice: true, avatar: true, llmInputTokens: 60_000, llmOutputTokens: 6_000 });
    expect(c.voice).toBeCloseTo(1.0, 4);
    expect(c.avatar).toBeCloseTo(0.5, 4);
    expect(c.total).toBeCloseTo(1.59, 2);
  });
});

describe("priceForMargin", () => {
  it("computes list price for a target margin", () => {
    expect(priceForMargin(1.59, 0.7)).toBeCloseTo(5.3, 1); // 1.59 / 0.3
  });
});
