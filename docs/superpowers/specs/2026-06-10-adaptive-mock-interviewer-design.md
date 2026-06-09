# Adaptive Mock Interviewer — Design Spec

**Date:** 2026-06-10
**Status:** Approved (scope pivot) → building
**Supersedes:** `2026-06-08-adaptive-video-tutor-design.md` (the YouTube voice-tutor concept). The
project keeps the `adaptive-video-tutor` directory name; the product is now an **adaptive AI mock
interviewer**.

> **Pivot:** From "voice tutor over a YouTube video" to "an AI interviewer that conducts a real mock
> interview for a candidate, configured by a job description + guidelines, adapts its follow-ups to
> the candidate's answers, and produces a scored feedback report." Everyone needs interview practice
> for many roles; this gives a realistic, adaptive, repeatable mock.

---

## 1. Concept

Paste a **job description** + a few **guidelines** (interview type, seniority, length, focus areas)
→ the system generates an **Interview Plan**, then runs a **voice interview**: the AI interviewer
speaks, the candidate answers aloud, and the interviewer **adapts** — probing deeper on weak/vague
answers, moving on from strong ones, covering all planned competencies within the budget. The
candidate's **webcam is recorded**. When the call ends, the system produces a **scored feedback
report** (per-competency scores, strengths, gaps, overall hire-signal).

## 2. Chosen approach

**Pre-plan + managed voice + post-call scoring.** Mirroring the strongest idea from the prior spec
(do the slow creative work up front), the heavy LLM work happens off the live path:

- **`prepare`** generates the Interview Plan once (cached).
- The **live loop** is a managed ElevenLabs Conversational AI agent (STT + turn-taking + TTS) whose
  custom LLM is **OpenRouter**; adaptivity is driven by the system prompt + injected Plan.
- **`score`** runs *after* the call over the transcript — no real-time constraint, fully ours.

**LLM topology (v1): point the ElevenLabs agent's custom LLM directly at OpenRouter.** The JD +
guidelines + Plan are injected per-session via ElevenLabs prompt **overrides + dynamic variables**.
This needs **no public server**, so it runs fully local from day one. A self-hosted LLM proxy
(intercepting live turns) is a documented v2 option, deferred to avoid a tunnel dependency.

Rejected: rolling our own real-time STT→LLM→TTS loop (turn-taking/interruptions are the hard part
to make "flawless"; the managed agent removes that risk). Browser-only STT (Chrome-locked, weaker).

## 3. Stack

- **Next.js 16** (App Router). **Local-first** (`next dev`); Vercel later.
- **ElevenLabs Conversational AI** agent via the `@elevenlabs/react` SDK (voice runtime).
- **OpenRouter** (OpenAI-compatible `/v1/chat/completions`) for plan-gen, the live interviewer LLM,
  and scoring. Default model routing: **Claude Sonnet** (latency/quality balance), swappable.
- **Supabase** — Postgres (configs, sessions, transcripts, feedback), Storage (webcam recordings),
  **Anonymous Auth** (so RLS scoping is real, not cosmetic).

**Verified capabilities (ElevenLabs docs, 2026-06-10):** custom LLM via OpenAI-compatible server
URL + Model ID + API key; transcript retrieval via `GET /conversations/{id}` and `post_call_transcription`
webhook; **Simulate Conversations** API for automated end-to-end testing of the adaptive loop.

## 4. Components — four isolated, separately-testable units

### A. Plan generation (`prepare`) — pure-ish, OpenRouter-backed
`{ jd_text, guidelines }` → one OpenRouter call → **InterviewPlan**. Cached by config hash.
The prompt **builder** is a pure function (testable without network); the LLM call is injected.

### B. Live runtime (voice) — managed
ElevenLabs agent does STT + turn-taking + TTS. Its custom LLM is OpenRouter. The **session-config
builder** (system prompt from persona + Plan, dynamic variables, overrides payload) is a pure
function. Adaptivity = prompt-driven (one question at a time; probe weak answers; advance on strong;
respect competency coverage + question/time budget; stay in role).

### C. Scoring (`score`) — pure-ish, OpenRouter-backed
`{ transcript, rubric }` → one OpenRouter call → **FeedbackReport** (structured). Post-call only.
Prompt builder pure; LLM call injected; output schema-validated with one retry on invalid JSON.

### D. Capture — browser
Candidate webcam via `MediaRecorder` → Supabase Storage. v1 records + stores + live self-preview.
**v2 seam:** AI-interviewer visual/avatar ("visual model generations") — not wired in v1.

**Boundary contract:** the runtime never needs to know how the Plan was made or how scoring works;
scoring never needs the live voice layer. All three external services (OpenRouter, ElevenLabs,
Supabase) sit behind thin injectable adapters so the core logic tests run with fakes.

## 5. Core data structures

```ts
Guidelines {
  type: "behavioral" | "technical" | "system-design" | "mixed"
  seniority: "intern" | "junior" | "mid" | "senior" | "staff+"
  budget: { kind: "questions"; count: number } | { kind: "minutes"; minutes: number }
  focusAreas: string[]        // e.g. ["distributed systems", "ownership"]
}

InterviewPlan {
  role: string                // inferred title from JD
  competencies: Competency[]  // the spine of the interview + the rubric
}

Competency {
  id: string                  // "system-design"
  label: string               // "System Design"
  weight: number              // relative importance (sums need not normalize)
  seedQuestions: string[]     // starting questions; live LLM may adapt/add follow-ups
  rubric: {
    levels: { score: 1|2|3|4|5; descriptor: string }[]  // what each score looks like
    signalsStrong: string[]
    signalsWeak: string[]
  }
}

FeedbackReport {
  perCompetency: { competencyId: string; score: 1|2|3|4|5; evidence: string }[]
  strengths: string[]
  gaps: string[]
  overall: number             // 1..5
  recommendation: "strong-no" | "no" | "lean-no" | "lean-yes" | "yes" | "strong-yes"
  summary: string
}
```

## 6. Data flow

1. **Configure:** paste JD + pick guidelines → `POST /api/interview/prepare` → InterviewPlan,
   persisted (cache hit on config hash returns instantly).
2. **Start:** candidate hits a device pre-flight (mic + cam), a `session` row opens, the
   `@elevenlabs/react` agent connects with the Plan injected via overrides/dynamic variables;
   webcam recording begins.
3. **Interview:** managed voice loop; OpenRouter drives adaptive questioning per the Plan.
4. **End:** recording uploads to Storage; transcript fetched (`GET /conversations/{id}`, webhook
   backup) and stored on the session.
5. **Score:** `POST /api/interview/score` → FeedbackReport, persisted.
6. **Review:** candidate sees the report (+ optional recording replay). Re-take supported.

## 7. Persistence — Supabase schema

```
interviews   id (pk) · jd_text · guidelines(jsonb) · config_hash · plan(jsonb) · created_at
             -- shareable config + cached Plan; NO candidate data

candidates   id (pk = anon-auth uid) · created_at

sessions     id (pk) · interview_id · candidate_id · el_conversation_id · status
             · started_at · ended_at · recording_url · transcript(jsonb)

feedback     id (pk) · session_id · report(jsonb) · created_at
```

**RLS:** `interviews` is readable by any authenticated candidate (shareable config, no PII).
`sessions`/`feedback` are scoped to `candidate_id = auth.uid()` via RLS — enforced through real
Supabase **Anonymous Auth** JWTs, not a hand-set cookie. Content vs. candidate data separated at the
**table** level (column-level limits are not RLS-enforceable).

## 8. Error handling & live-demo resilience

- **OpenRouter live failure / timeout** → OpenRouter model-fallback routing; the agent keeps the turn alive.
- **Plan-gen fails** → retry once; else a generic role-type default Plan so the interview can still run.
- **Scoring fails / invalid JSON** → schema-validate + one retry; else emit a partial report, never nothing.
- **Mic/cam blocked** → device pre-flight before start; webcam failure degrades to voice-only.
- **Transcript fetch fails** → `post_call_transcription` webhook backup path.
- **Connection drop** → SDK reconnect; session resumes.

## 9. Testing (toward "working flawlessly")

- **Unit (pure, no network):** Guidelines validation; config-hash; plan-prompt builder;
  session-config/system-prompt builder; scoring-prompt builder; InterviewPlan + FeedbackReport
  schema validators; transcript normalizer.
- **Integration (fakes / mocked clients):** `prepare` (fixture JD → valid Plan schema);
  `score` (fixture transcript + rubric → valid report); Supabase RLS scoping (candidate A cannot
  read candidate B); ElevenLabs session-token + overrides payload shape.
- **E2E:** ElevenLabs **Simulate Conversations** runs a scripted candidate against the live agent →
  transcript → `score` → report. This is the loop we iterate to "flawless".
- **TDD:** schema validators + all pure builders written test-first. Target 80%+ on core logic.

## 10. Scope

**v1 (now):** JD + guidelines config; plan-gen; voice interview with adaptive follow-ups; webcam
recording to Storage; transcript capture; scored feedback report; anonymous-auth persistence with
RLS; local-first.

**v2 (seams only):** AI-interviewer visual/avatar generation; recruiter/multi-candidate views;
richer analytics; deploy to Vercel; self-hosted LLM proxy for live-turn interception.

**Out of scope:** real accounts/SSO; payments; non-voice modalities; mobile-native.

## 11. Success criteria

1. Configure an interview from a real JD → run a voice interview → the interviewer **adapts** (a
   weak answer triggers a deeper probe; a strong answer advances).
2. After the call, a **scored FeedbackReport** is produced and persisted.
3. Candidate webcam is recorded and stored.
4. Every failure mode in §8 degrades gracefully (no dead-ends).
5. Core-logic tests green at 80%+; the Simulate-Conversations E2E passes a golden interview.
6. Runs locally with only the three provided keys in `.env`.
