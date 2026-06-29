# Phase 2 — In-App Screen Polish (Design Spec)

**Date:** 2026-06-29
**Status:** Approved to build autonomously (user granted: "make assumptions, premium product, finish in one go")
**Branch:** `feat/phase2-inapp-polish` off `main`

## Problem
Phase 1 shipped an investor-grade marketing **landing** (Direction A) live on prod. The signed-in **app screens** (config form, live interview, scoring, scorecard report, account) are a tier below: emoji glyphs instead of `lucide-react`, no `framer-motion` motion, and they don't use the refined design tokens. They got a "production design system" pass on 2026-06-10 but not the elevated landing treatment. This phase closes that gap so the whole product — especially the screens demoed live — reads premium.

## Goal
Elevate every signed-in screen to the landing's quality bar, reusing the existing foundation (tokens, `Reveal`, `framer-motion`, `lucide-react`). Purely presentational — no engine, billing, or route logic changes.

## Definition of Done
- All in-app screens use refined tokens + `lucide-react` icons (zero emoji glyphs) + tasteful, reduced-motion-safe motion.
- **Scorecard report** (centerpiece): animated score-ring count-up + animated meter fills on mount; staggered section reveals; lucide icons for recommendation / strengths / gaps; premium card treatment; polished recruiter panel.
- **Config form**: lucide `Mic`/`MessageSquare` segmented toggle; refined inputs/selects/submit; subtle entrance.
- **Live interview** (text + voice + competency rail): polished chat bubbles, voice-state UI, consistent type/spacing, lucide icons.
- **Scoring loading state, account page, stepper**: brought in line.
- All **165 vitest pass / 2 skipped** still green; new pure helpers tested; `tsc`/`lint`/`build` clean.
- Verified live (keyless + `FAKE_LLM` dogfood of config → interview → report) and shipped: PR → Vercel preview → merge to `main` → prod.

## Foundation additions (new, shared, tested)
Small motion primitives in `src/components/motion/`:
- **`CountUp`** — animates a number from 0 → target (e.g. the overall score). Pure easing helper `easeOutValue(progress, target)` is unit-tested; the component is `useReducedMotion`-aware (renders the final value instantly when reduced).
- **`GrowBar`** (or inline) — a width/scale transition for meter fills and competency bars, `whileInView`, reduced-motion-safe.

No new deps. Reuse `Reveal` for section entrances.

## Per-screen elevation checklist
Each screen keeps its logic/props; only presentation changes. The **landing components are the style reference** (`src/components/landing/*`).

1. **`ReportView.tsx`** (centerpiece)
   - Score ring: animate the arc + `CountUp` the numeric score on mount (reduced-motion → static).
   - `Meter`: animate fills (stagger), keep the 0–5 segment design; map colors via existing semantic intent (good/amber/danger).
   - Replace glyphs: strengths `✓`→`<Check>`, gaps/areas `!`→`<TriangleAlert>`, bullets `•`→`lucide` dot or `ArrowRight`; recommendation badge keeps tone, add a lucide icon.
   - Wrap the 3 sections (hero scorecard, competency breakdown, strengths/gaps) in staggered `Reveal`.
   - Tighten spacing/typography to match landing cards (`border-hairline`, radius, shadows).

2. **`RecruiterPanel.tsx`** — align card style + lucide icons; reveal on mount.

3. **`ConfigForm.tsx`**
   - Mode toggle: `🎙`→`<Mic>`, `💬`→`<MessageSquare>`; refine the segmented control.
   - Inputs/selects: keep behavior, refine focus/hover; the submit arrow already SVG — swap to lucide `ArrowRight`; spinner stays.

4. **`TextInterview.tsx`** — polish chat bubbles (interviewer vs candidate), typing/loading affordance, lucide send icon, consistent spacing.

5. **`VoiceInterview.tsx`** — polish the live voice state (status, mic indicator, end control) with lucide icons + the landing's waveform vibe where applicable.

6. **`CompetencyRail.tsx`** — refine the rail chips/states to match.

7. **`page.tsx`** — scoring loading card (premium animated state) + `Stepper` refinement; wrap step transitions tastefully.

8. **`account/page.tsx`** — bring the small account view in line (cards, lucide icons).

## Testing
- Unit-test the pure easing helper (`easeOutValue`) in `src/components/motion/countup.test.ts`.
- Components verified by `build` + the keyless/`FAKE_LLM` dogfood (config → text interview → report) with a screenshot pass; reduced-motion verified by emulation/fallback path.
- No regressions: full `vitest run` green; `tsc`/`lint`/`build` clean.

## Out of scope
New features, copy rewrites beyond icon/label swaps, engine/scoring/billing/route changes, the marketing landing (done), the avatar/webcam pipeline behavior (visual tweaks only if trivial).
