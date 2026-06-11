# Unit Economics

What one interview session costs us, so pricing covers it. A tested calculator lives in
`src/lib/cost.ts` (`estimateSessionCost`, `priceForMargin`).

> Rates are approximate (2026-06) — **verify on the live pricing pages before billing**.

## Cost drivers (per minute / per token)

| Component | Rate | Notes | Source |
|---|---|---|---|
| ElevenLabs voice | **~$0.10/min** | Creator/Pro; $0.08/min business overage; 95% discount for silence >10s; + LLM pass-through | [pricing](https://elevenlabs.io/pricing/agents) |
| Simli avatar | **~$0.05/min** | pay-as-you-go; **Trinity-1 avatar can be <$0.01/min**; free $10 + 50 min/mo | [simli.com](https://www.simli.com/) |
| LLM (Claude Haiku 4.5) | **$1/M in, $5/M out** | plan-gen + live turns + scoring (+ agent LLM for voice); prompt caching cuts input ~90% | [Anthropic](https://www.anthropic.com/news/claude-haiku-4-5) |

**Voice + avatar are per-minute; LLM is per-token and tiny by comparison.** Cost scales with
**session length**, not number of questions.

## Cost per 10-minute session

| Mode | Voice | Avatar | LLM | **Total** |
|---|---|---|---|---|
| **Text only** | $0 | $0 | ~$0.05 | **~$0.05** |
| **Voice** (no face) | $1.00 | $0 | ~$0.09 | **~$1.09** |
| **Voice + avatar** (Simli standard) | $1.00 | $0.50 | ~$0.09 | **~$1.59** |
| **Voice + avatar** (Trinity-1 ~$0.01/min) | $1.00 | $0.10 | ~$0.09 | **~$1.19** |

Text is ~**20–30× cheaper** than voice+avatar. A 20-minute session roughly **doubles** the voice +
avatar lines.

## Pricing to stay in profit

At ~$1.59 cost for a 10-min voice+avatar session, `priceForMargin(1.59, 0.70)` ≈ **$5.30/session**
for a 70% gross margin. Practical options:

- **Prepaid credits / session packs** (recommended for MVP): e.g. 5 sessions for $25 ($5 each).
  Cash upfront, no metered-billing complexity, and a hard stop against runaway cost.
- **Per-session charge**: charge after each session (needs a saved card + usage metering).
- **Free text tier + paid voice/avatar**: text is near-free, so offer it free to drive signups and
  charge only for voice/avatar (the expensive modes).

## Cost levers (keep margin healthy)

1. **Cap session length** — the single biggest lever (voice+avatar are per-minute). Enforce the
   question/time budget hard.
2. **Default to text**, reserve voice/avatar for paid/final rounds.
3. **Use Trinity-1** Simli avatar (~$0.01/min vs $0.05).
4. **Prompt caching** on the LLM (system prompt + plan + rubric repeat every turn → ~90% input savings).
5. **Silence discount** (ElevenLabs already gives 95% off long silences).
6. **ElevenLabs business/enterprise** tier lowers per-minute at volume.

## Next phase — charging users (to spec, not yet built)

The pieces, in order:

1. **Auth:** swap demo anonymous-auth for **Supabase Auth + Google OAuth** for paying users (keep
   anon for the free text trial). We already run Supabase.
2. **Payments provider:** pick one — **Dodo Payments** (merchant-of-record: handles global tax/VAT/GST,
   good for a solo/SaaS digital product, supports India) or **Razorpay/Stripe** (more setup, you own
   tax). Note: *FreeCharge* is a consumer UPI/wallet app, not a SaaS billing gateway — Dodo/Razorpay/
   Stripe are the right fit. Decide before building.
3. **Billing model:** prepaid credits (recommended) — a `credits`/`wallet` table, decrement on
   session start.
4. **Gating:** a voice/avatar session requires a positive balance; text stays free.
5. **Margin tracking:** record each session's estimated cost (`estimateSessionCost`) alongside the
   price charged, so real margin is visible per session.

This phase needs its own spec (provider choice, billing model, auth migration, webhook handling,
testing) before implementation.
