# Adaptive Video Tutor — Design Spec

**Date:** 2026-06-08
**Status:** Approved (brainstorming complete) → ready for implementation plan
**Purpose:** A job-application showcase demonstrating fitness for an AI agentic learning startup whose platform "doesn't just stream videos — it talks back, remembers, questions, adapts, and drives 10x better retention."

> Working name: `adaptive-video-tutor`. Brandable later. Deliberately NOT named after the target company's product.

---

## 1. Concept

Paste any YouTube URL → it becomes a **voice-first, mastery-gated lesson**. The video plays until a checkpoint, then pauses and the AI tutor asks *you* a question aloud. You answer by voice. The tutor grades your answer and **bends the timeline**:

- **Mastered** (confident + correct) → fast-forward past the redundant re-teach.
- **Shaky** (partial / unsure) → re-explain the concept simpler, replay the segment.
- **Wrong** (missed it) → remediate, then re-ask.

Mastery is remembered per learner, so returning sessions open with a quick recall of weak spots and auto-skip mastered concepts. This is the "talks back / questions / adapts / remembers / 10x retention" pitch made concrete in one tight loop.

## 2. Chosen approach

**Approach A — "Pre-plan the lesson, own the voice pipeline."** On paste, the transcript is fetched and an LLM generates the entire **Checkpoint Plan** up front in one batch (questions, rubrics, pre-written branch scripts/actions). Playback is client-driven; the live loop only does fast **grading + TTS + a branch lookup** — no creative generation mid-lesson. Voice I/O is built as a thin adapter (the seam where an ElevenLabs Conversational Agent could later drop in — Approach C — without touching lesson logic).

Rejected: B (just-in-time generation — mid-lesson latency, fragile for a live demo) and C as the primary path (gives up grading/branching control; fiddly video-control-via-agent-tools).

## 3. Stack

- **Next.js 16** (App Router), deployed to **Vercel** with a public URL.
- **Supabase** for persistence (lesson-plan cache + per-learner mastery/memory) with RLS.
- **ElevenLabs** for STT + TTS (behind an adapter).
- **LLM** (usual provider) for checkpoint-plan generation + answer grading.
- **YouTube IFrame Player API** for transcript fetch + playback control.

## 4. Components

### Frontend (client)
- **`LessonStage`** — hosts the YouTube IFrame player; owns the playback state machine: `playing → checkpoint → grading → branching → resuming`.
- **`CheckpointOverlay`** — voice UI shown on pause: push-to-talk mic, live transcript, tutor's spoken reply, and a visible "what just happened" indicator (✅ skipping ahead / 🔁 re-explaining / ↩️ remediating) so a *viewer* sees the timeline bend. Always includes a **type-instead** fallback.
- **`MasteryRail`** — side panel of concepts and their live mastery state; the "remembers / retention" story made visible.
- **`UrlIntake`** — paste-a-URL + the "preparing your lesson…" loader.

### Backend (route handlers / server actions)
- **`POST /api/lesson/prepare`** — `{youtubeUrl}` → cached `LessonPlan` by `videoId`, else fetch transcript + one LLM call → persist → return. (The one slow step.)
- **`POST /api/checkpoint/grade`** — `{checkpointId, learnerTranscript}` → `{decision, mastery, spokenFeedback?}`.
- **`POST /api/voice/stt`**, **`POST /api/voice/tts`** — thin ElevenLabs adapters (Approach-C swap point).

### Boundaries
Three independent, separately-testable units: lesson **content generation** (prepare), lesson **runtime** (grade + branch), and **voice I/O** (adapter). The runtime never knows whether voice is our pipeline or an ElevenLabs agent.

## 5. Core data structure — the Checkpoint Plan

Generated **once** by `prepare`, persisted, then the runtime just walks it. Everything needed at runtime is baked in, so the live loop only grades.

```ts
LessonPlan {
  videoId: string
  title: string
  concepts: Concept[]              // the spine of the MasteryRail
  checkpoints: Checkpoint[]        // ordered by timestamp
}

Concept {
  id: string                       // "newtons-2nd-law"
  label: string                    // "Newton's 2nd Law"
}

Checkpoint {
  id: string
  conceptId: string                // which concept this gates
  pauseAt: number                  // seconds — where the player pauses
  coversSegment: { start: number; end: number }  // stretch this checkpoint tests
  question: string                 // what the tutor asks aloud
  rubric: {
    keyPoints: string[]            // ideas a correct answer must hit
    commonMisconceptions: string[] // helps grader detect "shaky vs wrong"
  }
  branches: {
    mastered: Branch               // confident + correct
    shaky:    Branch               // partially right / unsure
    wrong:    Branch               // missed it
  }
}

Branch {
  spokenScript: string             // exactly what the tutor says (→ TTS)
  action:
    | { type: "resume" }                                     // continue from pauseAt
    | { type: "skipTo"; seconds: number }                    // fast-forward (mastered)
    | { type: "replaySegment"; start: number; end: number }  // re-watch (shaky)
    | { type: "reask" }                                      // remediate then re-ask (wrong)
}
```

**Grade → branch mapping:** `grade` returns `decision: "mastered" | "shaky" | "wrong"` + a `mastery` score. Runtime does `checkpoint.branches[decision]`, speaks `spokenScript`, executes `action`. The entire "timeline bends" mechanic is a lookup — no live branching logic to fail.

**Pre-written scripts:** the LLM writes re-explanations/remediations during `prepare`, so mid-lesson is only fast grading + TTS. Escape hatch: if grading detects a *novel* misconception, it may return an override `spokenFeedback` string (used rarely).

## 6. Data flow

**Happy path:**
1. Paste URL → `UrlIntake` → `POST /api/lesson/prepare`.
2. Cache hit on `videoId` → return instantly. Miss → fetch transcript, one LLM call → `LessonPlan`, persist, return.
3. `LessonStage` loads player, opens a `lesson_session`, plays to the next-unpassed checkpoint's `pauseAt`.
4. Pause → `CheckpointOverlay` → push-to-talk → `/api/voice/stt` → learner transcript.
5. `/api/checkpoint/grade` → `branches[decision]` → `/api/voice/tts` speaks script → execute `action` → write `checkpoint_attempt` + update `concept_mastery`.
6. `MasteryRail` re-renders. Repeat to end → session complete.

**Returning learner ("remembers"):** new session reads `concept_mastery`; weak prior concepts get a ~15s spoken recall at the start, mastered concepts auto-skip their checkpoints.

## 7. Persistence — Supabase schema

```
lesson_plans      videoId (pk) · title · plan (jsonb) · created_at
                  -- shared content cache, NO user data

learners          id (pk) · created_at        -- anonymous cookie id (demo auth)

lesson_sessions   id (pk) · learner_id · video_id · status · started_at · completed_at

checkpoint_attempts  id (pk) · session_id · checkpoint_id · concept_id
                     · transcript · decision · mastery · created_at

concept_mastery   (learner_id, concept_id) pk · mastery · last_seen_at
                  -- the durable "memory"
```

**RLS:** `lesson_plans` is public-readable content (no user data). Per-learner tables (`lesson_sessions`, `checkpoint_attempts`, `concept_mastery`) are scoped to the learner id via RLS. Content vs. user data are separated at the **table** level (not via policy comments — column-level restrictions are not enforceable by RLS).

**Auth:** lightweight anonymous cookie `learner` id — zero signup friction for an evaluator, but persistence/memory is real.

## 8. Error handling & live-demo resilience

This is a hiring demo; it must not die on stage.

- **No transcript / embed disabled** (detected in `prepare`) → fall back to a baked-in **curated demo `LessonPlan`** for a known-good video, with a gentle "using a sample lesson" note. Primary safety net.
- **STT empty / mic blocked** → tutor re-prompts once; **type-instead** is always available in the overlay.
- **LLM grade fails / times out** → default to the `shaky` branch (re-explain). Failing toward *more* teaching is pedagogically safe and never blocks progress.
- **TTS fails** → render `spokenScript` as text and continue. Voice degrades to text; the lesson never stalls.

## 9. Testing

- **Unit:** grade-decision→branch mapping; branch→player-action reducer; playback state machine (pure functions, no network).
- **Integration:** `prepare` (mock transcript → valid `LessonPlan` schema); `grade` (transcript + rubric → decision); RLS scoping (learner A cannot read learner B's mastery).
- **E2E (one golden flow):** paste URL → reach first checkpoint → answer → branch action executes (Playwright).
- **TDD:** schema validators and the state machine written test-first. Target 80%+ coverage.

## 10. Out of scope (YAGNI for a showcase)

- Real user accounts / login (anonymous cookie only).
- Uploading your own video; non-YouTube sources.
- Multi-language, payments, teacher dashboards, content library.
- The ElevenLabs **Agent** path (Approach C) — build the adapter seam, don't wire the agent.
- Mobile-native; responsive web suffices.

## 11. Success criteria

1. Paste a real YouTube URL → reach a voice checkpoint → answer aloud → see the timeline visibly branch (skip / re-explain / remediate).
2. Mastery persists: a second session opens by recalling a previously-weak concept.
3. Deployed to a public Vercel URL suitable to drop into the job application.
4. Every failure mode above degrades gracefully (no dead-ends).
5. Tests green at 80%+ on the core logic.
