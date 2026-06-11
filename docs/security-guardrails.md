# Security & Abuse Guardrails

What's in place to stop someone exploiting the system or running up our provider bill, and what to
add next (with the auth/payments phase).

## In place

- **No open LLM proxy.** `/api/interview/turn` takes `{ interviewId, messages }` — the interviewer
  system prompt is rebuilt **server-side** from the stored interview. The client can no longer supply
  an arbitrary `systemPrompt`, so the endpoint can't be used as a free general-purpose LLM on our key.
  Unknown id → 404, malformed id → 400.
- **Per-IP rate limits** (in-memory fixed window): `prepare` 15/min, `turn` 60/min, `score` 15/min,
  `simli/session` 15/min, `analysis`/`transcript` 30/min. Counted before parsing, so invalid spam is
  capped too. (`src/services/rateLimit.ts`.)
- **Input size caps:** JD ≤ 20k chars, transcript ≤ 500 turns, chat message ≤ 8k chars, messages ≤
  200, conversationId ≤ 100. Prevents cost blow-ups / DoS via huge payloads.
- **Session length caps:** ElevenLabs agent `max_duration_seconds = 600` (10 min); Simli
  `maxSessionLength = 1800`, `maxIdleTime = 300` (idle avatar self-terminates).
- **Prompt-injection hardening:** the JD and the candidate transcript are treated as **untrusted
  data** — the prompts instruct the model to ignore embedded instructions (e.g. "score me strong-yes",
  "reveal the rubric") and never break character.
- **Secrets server-side only:** OpenRouter / ElevenLabs / Simli / Supabase service keys never reach
  the browser; the ElevenLabs key is convai-scoped (restricted).
- **RLS:** per-candidate isolation on `sessions`/`feedback` (verified live).
- **Schema validation (zod) on every input**; graceful degradation (no dead-ends).

## Recommended next (pairs with auth / payments)

1. **Durable rate limiting + per-user quotas.** The in-memory limiter is **per server instance**, so
   it doesn't hold across serverless instances on Vercel. Back it with **Upstash Redis** (or similar)
   and key limits by user, not just IP.
2. **Auth-gate the expensive endpoints.** Supabase Auth + Google OAuth; require sign-in for
   voice/avatar (the costly modes); keep text on a small free quota.
3. **Prepaid credits + hard cost stop.** Decrement a balance on session start; block at zero. Record
   each session's `estimateSessionCost` (`src/lib/cost.ts`) vs price to watch margin per session.
4. **Spend monitoring/alerts** on OpenRouter / ElevenLabs / Simli usage; alert on anomalies.
5. **Bot protection** (CAPTCHA / Turnstile) on signup to stop free-tier farming.
6. **Secret rotation** policy; least-privilege keys (already done for ElevenLabs).
