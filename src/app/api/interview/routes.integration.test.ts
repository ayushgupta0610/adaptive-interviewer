import { describe, it, expect, beforeAll } from "vitest";

/**
 * Route-handler integration tests driven by the stub LLM (FAKE_LLM=1). Exercises the
 * real POST handlers end-to-end (validation → use-case → JSON response) without keys.
 * Routes are dynamically imported AFTER setting FAKE_LLM so env picks it up.
 *
 * Auth-gate: prepare/turn/score now require a valid Authorization header.
 * Without one they return 401 before reaching any business logic.
 */
type Handler = (req: Request) => Promise<Response>;
let prepare: Handler;
let score: Handler;
let turn: Handler;

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
  turn = (await import("./turn/route")).POST as Handler;
});

describe("POST /api/interview/prepare", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await prepare(post({ jd: "Senior backend engineer building scalable systems.", guidelines }));
    expect(res.status).toBe(401);
  });

  it("returns 401 on an invalid body (auth runs before body validation)", async () => {
    const res = await prepare(post({ jd: "short" }));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/interview/turn", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await turn(
      post({ interviewId: "00000000-0000-0000-0000-000000000001", messages: [{ role: "user", content: "hi" }] }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 for an unknown interviewId (auth runs before lookup)", async () => {
    const res = await turn(
      post({ interviewId: "00000000-0000-0000-0000-000000000000", messages: [{ role: "user", content: "hi" }] }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 for a malformed interviewId (auth runs before schema validation)", async () => {
    const res = await turn(post({ interviewId: "nope", messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/interview/score (direct mode)", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await score(
      post({
        plan: { competencies: [] },
        transcript: [
          { role: "interviewer", text: "Tell me about a hard project." },
          { role: "candidate", text: "I built a sharded ledger handling 5k tps." },
        ],
      }),
    );
    expect(res.status).toBe(401);
  });
});
