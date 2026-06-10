import { describe, it, expect } from "vitest";
import { normalizeAnalysis } from "./analysis";

describe("normalizeAnalysis", () => {
  it("normalizes a completed conversation's analysis", () => {
    const raw = {
      status: "done",
      analysis: {
        transcript_summary: "Senior backend interview about transactions.",
        call_summary_title: "Backend interview",
        evaluation_criteria_results: {
          technical_depth: { result: "success", rationale: "Discussed tradeoffs." },
          role_fit: { result: "unknown", rationale: "Insufficient signal." },
        },
        data_collection_results: {
          overall_recommendation: { value: "lean yes", rationale: "Solid but gaps." },
          key_strength: { value: "system design", rationale: "" },
        },
      },
    };
    const a = normalizeAnalysis(raw);
    expect(a.ready).toBe(true);
    expect(a.status).toBe("done");
    expect(a.summary).toContain("transactions");
    expect(a.criteria).toHaveLength(2);
    expect(a.criteria[0]).toEqual({ id: "technical_depth", result: "success", rationale: "Discussed tradeoffs." });
    expect(a.data.find((d) => d.key === "overall_recommendation")?.value).toBe("lean yes");
  });

  it("reports not-ready while still processing", () => {
    const a = normalizeAnalysis({ status: "processing", analysis: {} });
    expect(a.ready).toBe(false);
    expect(a.criteria).toHaveLength(0);
    expect(a.data).toHaveLength(0);
  });

  it("is safe on empty / malformed input", () => {
    expect(normalizeAnalysis(null).ready).toBe(false);
    expect(normalizeAnalysis({}).criteria).toEqual([]);
  });
});
