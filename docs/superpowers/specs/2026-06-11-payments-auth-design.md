# Payments + Auth — Design Spec

**Date:** 2026-06-11
**Status:** Draft for review → implementation plan
**Goal:** Charge for interview sessions sustainably (cover provider cost), gated behind real
accounts. India-primary, B2B-leaning but **individual accounts** for v1.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Account model | **Individual accounts** (each user signs in + pays for themselves; sell packs to companies offline for now) |
| Billing model | **Monthly subscription** (plan grants a capped number of sessions/month) |
| Free tier | **One free trial session, then pay** |
| Provider | **Cashfree now** (India: UPI/cards/netbanking, INR, GST), **Dodo later** behind a thin adapter |
| Auth | **Supabase Auth + Google OAuth** |

## Why a session cap matters (unit economics)

A voice+avatar session costs us **~$1.59** (10 min; see `docs/unit-economics.md`, `src/lib/cost.ts`).
A flat monthly subscription with *unlimited* voice sessions is an open-ended loss. So **each plan
grants a capped number of sessions/month** — the cap is the cost control. Max monthly cost per
subscriber ≈ `quota × per-session cost`; price the plan above that.

**Finalized pricing (target ≥25% gross margin even at 100% quota usage, worst case = every session
hits the 10-min cap, after ~3% Cashfree fee; FX ~₹85/USD — verify live):**

| Tier | Price | Quota (voice+avatar/mo) | Cost at full use | Margin (full, std avatar) |
|---|---|---|---|---|
| **Starter** | ₹999/mo | 4 | ~$6.36 | **~43%** |
| **Pro** | ₹1,999/mo | 10 | ~$15.90 | **~29%** |

- Switching paid sessions to the **Trinity-1 avatar** (~$0.01/min) lifts Pro's full-usage margin to
  **~46%** — recommended default for paid sessions.
- Realized margin is higher than the table (most users won't max the quota).
- The **10-min session cap + monthly quota** are the hard cost controls. Verify FX + exact Cashfree
  fee at launch and nudge prices if margin dips below 25%. (`src/lib/cost.ts` + `priceForMargin` can
  recompute.)
- **Text mode is free** (see below).

## Architecture

Three new concerns, each isolated:

1. **Auth** — Supabase Auth (Google OAuth). Replaces the demo anonymous-auth for real users. Every
   session is tied to `auth.uid()`.
2. **Entitlement** — pure logic: *can this user start a session right now?* Inputs: `free_trial_used`,
   subscription status, sessions used this period, requested mode. Output: allow/deny + reason.
3. **Billing** — a `PaymentProvider` adapter (Cashfree impl) for checkout/mandate creation +
   webhook handling. Subscription state lives in Supabase, updated by webhooks (source of truth =
   provider, mirrored locally).

```
 Browser ──(Google OAuth)──► Supabase Auth ──► JWT (auth.uid)
    │
    ├─ POST /api/session/start ─► entitlement check ─► consume (free trial | sub quota) ─► grant
    │        (must pass before prepare / voice / avatar)
    │
    └─ POST /api/billing/checkout ─► Cashfree ─► (user authorizes mandate) ─► webhook
                                                        │
                          POST /api/billing/webhook ◄───┘ (verify sig → update subscription)
```

## Data model (Supabase, additive to existing schema)

```
profiles            id (pk = auth.uid) · email · free_trial_used bool default false · created_at
plans               id (pk) · name · price_inr · monthly_session_quota · provider_plan_id
subscriptions       id (pk) · user_id · plan_id · provider · provider_subscription_id
                    · status (active|past_due|cancelled|expired) · current_period_start/end · created_at
-- session consumption is counted from the existing `sessions` table within the current period
-- (no reset job needed); add: sessions.mode ('text'|'voice') · sessions.est_cost_usd · sessions.billed bool
```

**RLS:** `profiles`/`subscriptions` scoped to `user_id = auth.uid()` (read-only to the user; writes
via service role in webhooks/gating). `plans` public-read.

## Entitlement logic (pure, TDD)

`canStartSession({ freeTrialUsed, subscription, sessionsUsedThisPeriod, mode }): { allowed, reason }`

- `mode === 'text'` and text is free → allow (or a generous cap).
- else (voice/avatar): allow if **subscription active AND sessionsUsedThisPeriod < quota**.
- else if **!freeTrialUsed** → allow (mark trial on consume).
- else → deny with reason `"trial_used"` / `"no_subscription"` / `"quota_exceeded"`.

`/api/session/start` runs this, records consumption (sets `free_trial_used` or relies on the period
session count), records `est_cost_usd` (from `src/lib/cost.ts`), and returns the grant. The interview
UI must call it before `prepare` / starting voice.

## Payment provider adapter

```
interface PaymentProvider {
  createSubscriptionCheckout(input: { userId; planId; email }): Promise<{ url }>;  // mandate/auth link
  verifyAndParseWebhook(req): Promise<BillingEvent>;   // signature-verified
  getSubscription(providerSubscriptionId): Promise<ProviderSubStatus>;
}
```
- **Cashfree impl:** Cashfree Subscriptions (recurring via UPI Autopay / eNACH / cards). Create
  plan + subscription → return the authorization link → customer authorizes → Cashfree charges per
  cycle → webhooks (`SUBSCRIPTION_STATUS`, payment success/failed) → update `subscriptions`.
  *(Verify exact Cashfree Subscriptions API + webhook signature scheme at implementation.)*
- **Dodo later:** same interface; merchant-of-record for global/tax.

## Webhooks — `POST /api/billing/webhook`

- **Verify the provider signature** (reject unsigned/forged — critical).
- Map event → update `subscriptions.status` + `current_period_end`.
- Idempotent (dedupe by provider event id).
- Never trust client-reported payment state; the webhook is the source of truth.

## Security (extends `docs/security-guardrails.md`)

- **Auth-gate** all expensive endpoints (`prepare`, `turn`, `score`, `simli/session`) — require a
  valid Supabase JWT; reject anonymous.
- **Durable, per-user rate limits** via **Upstash Redis** (replace the in-memory limiter, which is
  per-instance on Vercel). Key by `auth.uid()`.
- **Webhook signature verification**; idempotency.
- **Free-trial abuse:** tied to a Google-verified email; accept multi-account friction (note it).
- Keep existing guardrails (input caps, prompt-injection, schema validation, RLS).

## UI

- **Sign-in** (Google) — required before any interview.
- **Paywall / upgrade** screen when entitlement is denied (shows plan + Cashfree checkout).
- **Account / billing** page — subscription status, sessions used this period, manage/cancel.
- Free-trial banner ("1 free session") for new users.

## Testing

- **Unit (pure):** `canStartSession` across all states (trial/active/quota/expired/text-free).
- **Integration:** webhook signature verify + state transitions (active→past_due→cancelled);
  `/api/session/start` gating with mocked entitlement; RLS scoping (user can't read another's
  subscription).
- **E2E (sandbox):** Cashfree sandbox checkout → mandate → webhook → subscription active → session
  allowed; then quota exceeded → denied.

## Out of scope (v1)

- Organization/team accounts (chosen individual).
- Dodo / global payments (later, same adapter).
- Proration / mid-cycle plan changes (changes apply next cycle).
- Manual invoicing/GST handling beyond what Cashfree provides.

## Resolved decisions

1. **Tiers/pricing:** Starter ₹999 (4) and Pro ₹1,999 (10) — see pricing table (≥25% margin guaranteed).
2. **Text mode is FREE**, but guarded against AI/cost abuse: **auth required** (no anonymous),
   **per-user daily cap** (e.g. 5 free text sessions/user/day), per-user rate limits, and the
   `/turn` open-proxy is already closed (server-derived prompt). Text cost is ~$0.05/session, so the
   daily cap bounds worst-case free spend to a few cents/user/day.
3. **Free trial = one full voice+avatar session** (best wow). Low expected volume → acceptable
   (~$1.59 each); **monitor** trial usage + spend and tighten if abused.
4. **Cashfree account is ready** (merchant + sandbox creds available for build/test).
