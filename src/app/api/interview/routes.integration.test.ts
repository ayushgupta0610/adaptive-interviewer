import { describe, it, expect, beforeAll } from "vitest";

/**
 * Route-handler integration tests driven by the stub LLM (FAKE_LLM=1). Exercises the
 * real POST handlers end-to-end (validation → use-case → JSON response) without keys.
 * Routes are dynamically imported AFTER setting FAKE_LLM so env picks it up.
 */
type Handler = (req: Request) => Promise<Response>;
let prepare: Handler;
let score: Handler;

function post(body: unknown): Request {
  return new Request("http://test/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const guidelines = {
  type: "technical",
  seniority: "senior",
  budget: { kind: "questions", count: 3 },
  focusAreas: ["apis"],
};

beforeAll(async () => {
  process.env.FAKE_LLM = "1";
  prepare = (await import("./prepare/route")).POST as Handler;
  score = (await import("./score/route")).POST as Handler;
});

describe("POST /api/interview/prepare", () => {
  it("returns 200 with a plan and overrides", async () => {
    const res = await prepare(post({ jd: "Senior backend engineer building scalable systems.", guidelines }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.plan.competencies.length).toBeGreaterThan(0);
    expect(data.overrides.agent.prompt.prompt).toContain("interviewer");
    expect(data.systemPrompt.toLowerCase()).toContain("one question at a time");
  });

  it("returns 400 on an invalid body", async () => {
    const res = await prepare(post({ jd: "short" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/interview/score (direct mode)", () => {
  it("returns 200 with a feedback report", async () => {
    const prep = await (await prepare(post({ jd: "Senior backend engineer role description.", guidelines }))).json();
    const res = await score(
      post({
        plan: prep.plan,
        transcript: [
          { role: "interviewer", text: "Tell me about a hard project." },
          { role: "candidate", text: "I built a sharded ledger handling 5k tps." },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.report.overall).toBeGreaterThanOrEqual(1);
    expect(data.report.overall).toBeLessThanOrEqual(5);
    expect(data.report.perCompetency.length).toBeGreaterThan(0);
  });
});
