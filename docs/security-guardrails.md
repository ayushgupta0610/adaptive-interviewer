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

## Malicious / untrusted job-description content

The JD is the main free-text input. How it's contained:

- **No XSS.** JD-derived text (role, competency labels, seed questions) renders as **escaped React
  text** — no `dangerouslySetInnerHTML` / `innerHTML` / `eval` anywhere, so a `<script>` JD is inert.
- **Structure locked.** The plan is **schema-validated** (`InterviewPlanSchema`) before use/store, so
  injection can't change the output shape or inject anything executable — only string *contents*.
- **Size + rate caps** (20k chars, 15/min) → no cost/DoS via JD.
- **No SSRF.** The JD is just text to the LLM; nothing fetches URLs from it.
- **Prompt-injection hardening.** The plan prompt treats the JD as DATA, not instructions; the live
  agent has ElevenLabs' **prompt-injection guardrail enabled** (catches candidate-side injection
  mid-call → ends the call).

Gaps / recommended:

- **No explicit content moderation** on the JD (toxic / abusive / illegal). Today we rely on the
  model's built-in safety + the schema. Add a cheap **moderation pass** (Anthropic/OpenAI moderation
  or a classifier) at `prepare` time before generating the plan — reject or flag.
- **LLM prompt injection is mitigated, not eliminated** — injected text could still surface inside a
  seed question. A moderation pass + a "is this actually a job description?" relevance check reduce it.
- ElevenLabs **content-category guardrails** (sexual / harassment / self-harm) are left off to avoid
  false positives in legitimate interviews — enable/tune per your tolerance.

## Payments + auth — required before production

The `feat/payments-auth` branch passed a security review; these CRITICAL/HIGH/MED items were **fixed**
on it: forged-webhook-when-secret-unset, free-trial double-spend race (atomic `claimFreeTrial`),
env-misconfig auth bypass, webhook rate-limit, error-message leak, webhook replay/staleness, checkout
email check, `server-only` guard on env.

**Still required before going live (deferred, tracked here):**
- **Quota-race (concurrency):** the paid monthly quota check (count → allow) isn't yet atomic — under
  concurrent requests a user could squeeze a couple of extra sessions. Wrap the count+insert in a
  Postgres transaction with `SELECT ... FOR UPDATE` (or an advisory lock) before high volume.
- **Webhook idempotency store:** persist the webhook `eventId` (unique index) and skip duplicates, so
  a re-sent old `subscription_active` can't re-activate a cancelled sub.
- **Rate-limit IP trust:** `clientIp` trusts `x-forwarded-for` (spoofable). On Vercel use the
  platform-set header / require Upstash; treat the in-memory limiter as best-effort only.
- **Require Upstash in production** (in-memory resets on cold starts) — make `hasUpstash` a prod assertion.
- **`past_due` UX:** entitlement blocks `past_due` with the generic paywall; surface a distinct
  "update your card" prompt.
- **postcss** moderate advisory in the Next dependency tree — upgrade when a non-breaking patch lands.

**Manual setup to activate (plan Task 15):** apply migrations `0002`/`0003`, enable Google in Supabase
Auth, create the two Cashfree subscription plans + store `provider_plan_id`, point the Cashfree webhook
at `/api/billing/webhook`, set `CASHFREE_*` + `UPSTASH_*` env (incl. `CASHFREE_WEBHOOK_SECRET`), then
run the sandbox E2E.

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
