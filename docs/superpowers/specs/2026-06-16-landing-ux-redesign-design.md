# Landing + UX Redesign — Design Spec

**Date:** 2026-06-16
**Status:** Approved (brainstorm) → ready for implementation plan
**Branch target:** new branch off `feat/payments-auth` (depends on the payments/auth work)

## Problem

The signed-out experience (what a cold investor or user sees first at `adaptive-interviewer.vercel.app`)
is a single small "Sign in to start / Continue with Google" card floating in a sea of whitespace.
It communicates nothing about what the product does, why it's good, or who it's for. To impress
investors and stand next to SF-grade products, the first impression must sell the product, and the
screens we demo must look top-tier. Pricing (₹999/₹1,999) is also too high for the Indian mass market.

## Goals

1. A real **marketing landing page** for the signed-out state — clear pitch, live-demo feel, the
   payoff (scorecard), how it works, honest pricing, strong CTA.
2. **Restructure the entry flow:** signed-out users see the landing; signed-in users drop straight
   into the app. CTAs trigger the existing Google OAuth.
3. **Reprice** to an affordable, India-friendly, still-profitable structure on the built Cashfree
   subscription system.
4. Elevate the **shared design-system foundation** (tokens, type scale, motion, icons) so both the
   landing and (Phase 2) the in-app screens feel cohesive and premium.

## Non-goals (this spec)

- Deep visual overhaul of the in-app screens (live interview, full report, config form, account).
  That is **Phase 2** — a separate spec — and rides on the design-system foundation laid here.
- Changing the interview/scoring engine, the voice/avatar pipeline, or the billing architecture
  (we reprice within the existing subscription model; no credits ledger).
- Any fabricated social proof (testimonials, logos, user counts). The product is the proof.

## Decisions locked (from brainstorm)

| Decision | Choice |
|---|---|
| Visual direction | **A — Clean & Confident** (light; refine existing indigo/slate/Geist, not a rewrite) |
| Motion | **Tasteful** — fade/rise on scroll, hover states, an auto-playing hero "live interview" loop. Add `framer-motion`. |
| Icons | Add `lucide-react` |
| Credibility | **Product-as-proof** — sample scorecard carousel; no invented testimonials/logos/metrics |
| Pricing model | **Reprice existing subscriptions** (no credits) |
| Payments | **Cashfree** (already integrated) |

## Pricing (new)

Free tier is entitlement-driven (no plans row). Paid tiers are rows in the `plans` table.

| Tier | Price | Voice interviews / mo | Text | Notes |
|---|---|---|---|---|
| **Free** | ₹0 | 1 (one-time free trial) | daily cap (fair-use) | drives signups; text ≈ free to serve |
| **Plus** (`starter` id) | **₹299/mo** | 3 | unlimited | profitable in practice via breakage |
| **Pro** (`pro` id) | **₹699/mo** | 10 | unlimited | priority models |

Unit-economics basis (from `docs/unit-economics.md`): voice ≈ $1.09 (~₹90) / 10-min session; text ≈ $0.05.
Numbers are easily tuned later — they live in one migration seed + one Paywall component.

**Required changes for "unlimited text" to be true:**
- `plans` table seed (migration `0002`): update `starter`→ name "Plus", price 299, quota 3; `pro`→ price 699, quota 10. (Migration not yet applied, so edit in place.)
- Entitlement (`src/core/entitlement.ts`): an **active subscriber bypasses the text daily cap**
  (today the cap applies to everyone). Add: if `subscription.status === "active"` and `mode === "text"`,
  allow without the cap. Keep the daily cap for free users.
- `Paywall.tsx` + landing pricing section: reflect ₹299 / ₹699 and the free-tier line.

## Entry-flow restructure

Today `src/app/page.tsx` wraps the whole app in `AuthGate`, so signed-out users only see the auth card.

New behavior on `/` (home):
- **Signed out** → render the **Landing** page (public, no auth). Its CTAs call the existing
  `supabaseBrowser().auth.signInWithOAuth({ provider: "google" })`.
- **Signed in** → render the **app** (the current `ConfigForm` → interview flow), unchanged in logic.
- **Keyless/demo mode** (no Supabase configured) → render the app directly, preserving the local demo.

`AuthGate`'s role narrows: it no longer renders a bare card on `/`; the landing IS the signed-out state.
The small auth card pattern is retained only where a mid-flow sign-in prompt is still needed (if any).
`Paywall` continues to gate *quota-exceeded* states inside the app.

## Design-system foundation (shared, light/Direction A)

Refine `globals.css` `@theme` tokens and `src/components/ui.tsx` primitives. Keep Geist + indigo brand.

- **Color:** keep `brand` indigo scale; add semantic tokens for success/warn/danger used by scorecards;
  formalize slate text/border/surface tokens already used ad-hoc.
- **Type scale:** define display / h1 / h2 / body / caption sizes with tight letter-spacing on headings
  (the mockup's `-0.02em`–`-0.025em`).
- **Spacing & radius:** standardize section padding, card radius (14–16px), max content width (keep `max-w-5xl`
  for app; landing uses a wider hero band with contained content).
- **Motion:** `framer-motion` wrappers — a `Reveal` component (fade+rise on enter, respects
  `prefers-reduced-motion`), hover transitions on buttons/cards, and the hero demo loop. Keep existing
  CSS `fade-in`/`rise` keyframes for non-JS fallback.
- **Icons:** `lucide-react`, used in how-it-works steps and feature tiles.

## Landing page — information architecture

New `src/components/landing/` directory; `page.tsx` renders `<Landing />` when signed out. Sections,
each its own focused component:

1. **Nav** (`LandingNav`) — logo + Beta chip, links (How it works, Pricing, Sign in), primary
   "Start free" button. Sticky, translucent, blurred. Replaces the marketing use of `TopBar`
   (the status-dot `TopBar` stays for the in-app view).
2. **Hero** (`Hero`) — pill badge, headline ("Practice the interview before it counts." — swappable),
   subhead, primary CTA ("Start your free interview" → OAuth) + secondary ("See how it works" → scrolls).
   Trust line ("first voice interview free · no card · ~10 min"). Right side: an **auto-playing
   "live interview" demo card** that loops interviewer-question → waveform → adaptive follow-up
   (the differentiator). Pure presentational loop; no backend.
3. **How it works** (`HowItWorks`) — 3 steps (paste JD → voice interview that adapts → scored like a panel),
   each icon + title + one line.
4. **Scorecard carousel** (`ScorecardCarousel`) — "See exactly where you stand — for any role." Role pills
   (Backend Engineer, Product Manager, Data Scientist, UX Designer, Account Executive, "+ any JD") that
   select a card; horizontal slider with arrows, dots, and swipe; active card + peek of next. Cards reuse
   the approved scorecard design (role · competency bars · strength/gap notes). Content is static sample
   data in a typed array (`samples.ts`), clearly sample (not real user data).
5. **Why it's different** (`Features`) — 3–4 tiles: truly adaptive follow-ups, voice-first realism,
   JD-tailored rubric (+ optional: recruiter-grade report).
6. **Pricing** (`Pricing`) — Free / Plus ₹299 / Pro ₹699, Pro highlighted; honest free-tier line; CTAs.
   The same plan ids feed the existing checkout.
7. **Final CTA** (`FinalCta`) — "Walk in ready." + Continue with Google.
8. **Footer** — refined (already present in `layout.tsx`); tidy links.

A single empty slot above the Final CTA is reserved for a *real* proof strip (a beta quote / number)
if one exists before the meeting — left out until real.

## Components — inventory

- **New:** `landing/LandingNav`, `landing/Hero`, `landing/HeroDemo` (the loop), `landing/HowItWorks`,
  `landing/ScorecardCarousel`, `landing/ScorecardCard`, `landing/Features`, `landing/Pricing`,
  `landing/FinalCta`, `landing/samples.ts`, `motion/Reveal`.
- **Changed:** `page.tsx` (signed-out → Landing), `AuthGate` (narrowed role), `Paywall` (new prices),
  `ui.tsx` (primitive refresh), `globals.css` (tokens), `entitlement.ts` (paid text bypass),
  migration `0002` seed.
- **Unchanged logic:** interview/voice/score/report engine, billing webhook/checkout, status `TopBar`.

## Accessibility & responsive

- All interactive elements keyboard-reachable; carousel operable by arrow keys + visible focus.
- `prefers-reduced-motion` disables the hero loop and reveal animations (show final state).
- Mobile: hero stacks (copy over demo card), carousel becomes one-card swipe, pricing stacks.
- Color contrast AA for text on the light surfaces and on brand-filled buttons.

## Performance

- `framer-motion` and `lucide-react` are the only new deps; tree-shake icons (named imports).
- Hero demo loop is CSS/JS-light (no video); waveform is animated divs.
- Landing is mostly static and should remain a fast first paint; keep the existing radial-gradient bg.
- Watch bundle size; lazy-load the carousel below the fold if needed.

## Testing

- **Unit:** `entitlement.ts` paid-subscriber text-bypass (extend existing `entitlement.test.ts`).
- **Component:** `ScorecardCarousel` selection/next/prev logic; `Pricing` renders the 3 tiers with
  correct ids feeding checkout.
- **Integration (existing pattern):** signed-out `/` renders Landing; signed-in renders app;
  keyless mode renders app. (Mock the Supabase session like existing route tests.)
- **Manual/visual:** dogfood the deployed preview at desktop + mobile widths; verify OAuth CTA round-trip
  and that quota-exceeded still shows the (repriced) Paywall.
- Keep `tsc`/lint/`build`/vitest green; respect Next 16 conventions (read `node_modules/next/dist/docs/`
  before writing route/layout code, per `AGENTS.md`).

## Risks / open items

- **Plan id naming:** we keep ids `starter`/`pro` (display "Plus"/"Pro") to avoid touching the
  `z.enum(["starter","pro"])` in checkout/session. Flagged so copy ("Plus") vs id ("starter") is intentional.
- **"Unlimited text" honesty:** depends on the entitlement bypass above shipping with the copy.
- **Breakage assumption:** Plus margin relies on subscribers not maxing voice quota; track real cost vs
  price per session (usage ledger already records this) to validate post-launch.
- **Headline/copy** is provisional and easily swapped.

## Out of scope (→ Phase 2 spec)

In-app screen redesign: live interview UI, full `ReportView`, `ConfigForm`, `account` page,
`RecruiterPanel`, avatar/webcam surfaces. These inherit the design-system foundation from this spec.
