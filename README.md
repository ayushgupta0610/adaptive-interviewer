# Adaptive Mock Interviewer

Paste a **job description** + a few **guidelines** → an AI interviewer runs an adaptive mock
interview (voice or text), then produces a **scored feedback report**. It probes deeper on weak
answers and moves on from strong ones.

Design spec: [`docs/superpowers/specs/2026-06-10-adaptive-mock-interviewer-design.md`](docs/superpowers/specs/2026-06-10-adaptive-mock-interviewer-design.md).

## Architecture — four isolated units

| Unit | What it does | Where |
| --- | --- | --- |
| **prepare** | JD + guidelines → cached `InterviewPlan` (competencies + rubric) | `src/usecases/prepare.ts`, `src/core/planPrompt.ts` |
| **runtime** | the live interview; adaptivity is the system prompt | `src/core/sessionConfig.ts` (voice) + `src/usecases/turn.ts` (text) |
| **score** | transcript + rubric → `FeedbackReport` | `src/usecases/score.ts`, `src/core/scoringPrompt.ts` |
| **voice** | ElevenLabs agent (STT + turn-taking + TTS) | `src/services/elevenlabs.ts`, `src/components/VoiceInterview.tsx` |

External services (OpenRouter / ElevenLabs / Supabase) sit behind thin **injectable adapters**
(`src/services/*`), so the core logic is tested with fakes (`npm test`, no network).

## Capability tiers (degrades gracefully by which keys are present)

- **OpenRouter only** → full **text** interview + adaptive follow-ups + scored report (in-memory plan cache).
- **+ ElevenLabs** → **voice** interview with webcam, live transcript.
- **+ Supabase** → durable plan cache, sessions, transcripts, feedback, with RLS.

The home page shows which services are configured; missing-key routes return a clear `503`.

## Run it

```bash
npm install
cp .env.example .env.local   # fill in keys (see below)
npm run dev                  # http://localhost:3000
```

**No keys yet?** Run the whole text pipeline (prepare → interview → score) against a deterministic
stub LLM:

```bash
FAKE_LLM=1 npm run dev
```

### Keys (`.env.local`)

- `OPENROUTER_API_KEY` — required. `OPENROUTER_MODEL` defaults to `anthropic/claude-sonnet-4.6`.
- `ELEVENLABS_API_KEY` + `NEXT_PUBLIC_ELEVENLABS_AGENT_ID` — for voice.
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` — for persistence.

### ElevenLabs agent setup (voice)

1. Create a Conversational AI agent in the ElevenLabs dashboard.
2. Set its **Custom LLM** to OpenRouter: server URL `https://openrouter.ai/api/v1`, model =
   `OPENROUTER_MODEL`, secret `OPENAI_API_KEY` = your OpenRouter key.
3. Enable **overrides** for system prompt + first message (the app injects the per-interview persona).
4. Paste the agent id into `NEXT_PUBLIC_ELEVENLABS_AGENT_ID`.

### Supabase setup (persistence)

Apply `supabase/migrations/0001_init.sql` (SQL editor or `supabase db push`) and enable
**Anonymous Sign-ins** so RLS scopes each candidate by `auth.uid()`.

## Commands

```bash
npm test          # unit + integration (fakes; no network)
npm run coverage  # coverage on the core logic
npm run lint
npm run build
```

## Status

- ✅ Core engine (domain, prompt/session builders, prepare/score/turn) — **49 tests, ~96% core coverage**.
- ✅ API routes + UI (config → interview → report); text mode runs with only OpenRouter.
- ✅ Supabase schema + RLS + key-gated RLS test; ElevenLabs adapter + voice UI.
- ⏳ Pending live keys: end-to-end voice run, and the ElevenLabs **Simulate Conversations** E2E.
- ⏳ Remaining wire-up: upload the webcam recording to Supabase Storage (`recording_url` already in schema).
