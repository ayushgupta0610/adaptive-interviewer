import { describe, it, expect, beforeAll } from "vitest";

/**
 * Route-handler integration tests driven by the stub LLM (FAKE_LLM=1). Exercises the
 * real POST handlers end-to-end (validation → use-case → JSON response) without keys.
 * Routes are dynamically imported AFTER setting FAKE_LLM so env picks it up.
 *
 * Auth-gate behaviour:
 *   - When NEXT_PUBLIC_SUPABASE_URL is set, prepare/turn/score require a valid
 *     Authorization header and return 401 without one.
 *   - When Supabase is NOT configured (as in this test env), auth is bypassed and the
 *     routes run their normal business logic.
 */
type Handler = (req: Request) => Promise<Response>;
let prepare: Handler;
let score: Handler;
let turn: Handler;

function post(body: unknown, authHeader?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (authHeader) headers["authorization"] = authHeader;
  return new Request("http://test/api", {
    method: "POST",
    headers,
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

describe("POST /api/interview/prepare (no Supabase configured — auth bypassed)", () => {
  it("returns 400 on a short JD (auth bypassed, body validation runs)", async () => {
    const res = await prepare(post({ jd: "short", guidelines }));
    // Auth is bypassed in keyless mode; body validation triggers.
    expect(res.status).toBe(400);
  });

  it("returns 200 with a valid request in FAKE_LLM mode", async () => {
    const res = await prepare(
      post({ jd: "Senior backend engineer building scalable systems at a fintech.", guidelines }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { interviewId: string };
    expect(body.interviewId).toBeDefined();
  });
});

describe("POST /api/interview/turn (no Supabase configured — auth bypassed)", () => {
  it("returns 404 for an unknown interviewId (auth bypassed, lookup runs)", async () => {
    const res = await turn(
      post({ interviewId: "550e8400-e29b-41d4-a716-446655440000", messages: [{ role: "user", content: "hi" }] }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed interviewId (auth bypassed, schema validation runs)", async () => {
    const res = await turn(post({ interviewId: "nope", messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/interview/score (direct mode, no Supabase configured — auth bypassed)", () => {
  it("returns 200 with a valid plan + transcript in FAKE_LLM mode", async () => {
    const res = await score(
      post({
        plan: {
          role: "Backend Engineer",
          competencies: [
            {
              id: "c1",
              label: "Systems Design",
              weight: 1,
              seedQuestions: ["Design a rate limiter."],
              rubric: {
                levels: [{ score: 3, descriptor: "Meets expectations" }],
                signalsStrong: [],
                signalsWeak: [],
              },
            },
          ],
        },
        transcript: [
          { role: "interviewer", text: "Tell me about a hard project." },
          { role: "candidate", text: "I built a sharded ledger handling 5k tps." },
        ],
      }),
    );
    expect(res.status).toBe(200);
  });
});
