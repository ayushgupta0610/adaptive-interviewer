# Phase 2 — In-App Screen Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate every signed-in screen (config form, live interview, scoring, scorecard report, recruiter panel, account) to the landing's premium quality bar — presentational only, no logic changes.

**Architecture:** Add one small tested motion primitive (`CountUp` + `easeOutValue`), then polish each existing component in place: swap emoji → `lucide-react` icons, apply refined tokens (`border-hairline`, `surface`/`surface-muted`, semantic `good`/`gap`), and add tasteful `framer-motion` motion (mount reveals, score-ring + meter animation) that respects `prefers-reduced-motion`. The **landing components (`src/components/landing/*`) are the style reference.**

**Tech Stack:** Next 16, Tailwind v4 tokens in `globals.css`, `framer-motion` (`Reveal` at `src/components/motion/Reveal.tsx`, `useReducedMotion`), `lucide-react`, existing `ui.tsx` primitives (`Card`, `Button`, `Badge`, `Spinner`, `cn`). vitest (node env). `@/` → `src/`.

**Note on granularity:** Task 1 is net-new → exact code + TDD. Tasks 2-7 polish existing files to match the landing reference → each gives a precise change-list + hard constraints + acceptance, and the implementer reads the target file and applies it. Do NOT change component logic, props, state, or data flow — visuals only.

---

### Task 1: CountUp motion primitive (TDD)

**Files:**
- Create: `src/components/motion/countup.ts`
- Test: `src/components/motion/countup.test.ts`
- Create: `src/components/motion/CountUp.tsx`

- [ ] **Step 1: Write the failing test** — `src/components/motion/countup.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { easeOutValue } from "./countup";

describe("easeOutValue", () => {
  it("is 0 at t=0 and the target at t=1", () => {
    expect(easeOutValue(0, 5)).toBe(0);
    expect(easeOutValue(1, 5)).toBe(5);
  });
  it("clamps out-of-range progress", () => {
    expect(easeOutValue(-1, 5)).toBe(0);
    expect(easeOutValue(2, 5)).toBe(5);
  });
  it("eases out — past the linear midpoint at t=0.5", () => {
    expect(easeOutValue(0.5, 10)).toBeGreaterThan(5);
  });
});
```

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/components/motion/countup.test.ts` (module not found).

- [ ] **Step 3: Implement the helper** — `src/components/motion/countup.ts`:

```ts
/** Eased value at progress t∈[0,1] toward target, using easeOutCubic. Clamps t. */
export function easeOutValue(t: number, target: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  const eased = 1 - Math.pow(1 - clamped, 3);
  return eased * target;
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Implement the component** — `src/components/motion/CountUp.tsx`:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { easeOutValue } from "./countup";

interface CountUpProps {
  value: number;
  /** Decimal places to render. */
  decimals?: number;
  durationMs?: number;
}

/** Animates 0 → value on mount with an ease-out. Renders the final value instantly under reduced motion. */
export default function CountUp({ value, decimals = 1, durationMs = 900 }: CountUpProps) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    let start: number | null = null;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const t = (ts - start) / durationMs;
      setDisplay(easeOutValue(t, value));
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, durationMs, reduce]);

  return <>{display.toFixed(decimals)}</>;
}
```

- [ ] **Step 6: Verify** — `npm run build && npx vitest run` green.

- [ ] **Step 7: Commit** — `git add src/components/motion/countup.ts src/components/motion/countup.test.ts src/components/motion/CountUp.tsx && git commit -m "feat(ui): CountUp animated-number primitive (reduced-motion safe)"`

---

### Task 2: ReportView — the scorecard centerpiece

**Files:** Modify `src/components/ReportView.tsx`

**Change-list (read the file first; keep ALL props, helpers `label`/`scoreColor`, the `REC` map, and data flow unchanged):**
- [ ] Import `Reveal` from `@/components/motion/Reveal`, `CountUp` from `@/components/motion/CountUp`, and from `lucide-react`: `Check`, `TriangleAlert`, `ThumbsUp`, `ThumbsDown`, `Minus`.
- [ ] **Score ring + number:** replace the static `{report.overall.toFixed(1)}` with `<CountUp value={report.overall} decimals={1} />`. Animate the ring arc: make the progress `<circle>` a `motion.circle` (import `motion` from `framer-motion`), `initial={{ strokeDasharray: "0 264" }} animate={{ strokeDasharray: \`${(pct / 100) * 264} 264\` }} transition={{ duration: 0.9, ease: [0.16,1,0.3,1] }}`. Under reduced motion (`useReducedMotion`), render the final dasharray with no animate. Keep the gradient + `-rotate-90`.
- [ ] **Recommendation badge:** keep the `Badge tone={rec.tone}`, but prepend a lucide icon inside it by tone — `green → <ThumbsUp size={13}/>`, `amber → <Minus size={13}/>`, `rose → <ThumbsDown size={13}/>`. (Add an icon lookup beside `REC`.)
- [ ] **`Meter` fills:** animate the filled segments in with a staggered scale/opacity — wrap each filled `<span>` as a `motion.span` with `initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ delay: i * 0.05, duration: 0.3 }}` (origin-left). Unfilled segments stay static. Reduced-motion → no animation.
- [ ] **Strengths/Gaps:** replace the `✓` glyph tile with `<Check size={13}/>` (keep emerald tile), the `!` glyph with `<TriangleAlert size={13}/>` (keep amber tile); replace the `•` bullets with a small lucide `Check` (strengths, emerald) and `TriangleAlert`/dot (gaps, amber) OR keep a styled dot — pick lucide `Check`/`Dot`. Use the semantic tokens where they read cleaner (`text-good`/`text-gap`) but emerald/amber is acceptable since these are status colors.
- [ ] **Section entrances:** wrap the three top-level blocks (hero `Card`, competency `Card`, strengths/gaps grid) each in `<Reveal delay={i*0.08}>`.
- [ ] **Card polish:** align radii/borders to the landing (`border-hairline` where `Card` borders show); keep the `Card` primitive.

**Constraints:** no change to `report`/`plan` shape usage, scoring math, or `onRestart`. `RecruiterPanel` render stays (`{conversationId && <RecruiterPanel .../>}`).

- [ ] **Verify:** `npm run build && npx tsc --noEmit && npx vitest run` all green.
- [ ] **Commit:** `git add src/components/ReportView.tsx && git commit -m "feat(ui): premium scorecard — animated ring/score/meters, lucide icons, reveals"`

---

### Task 3: RecruiterPanel

**Files:** Modify `src/components/RecruiterPanel.tsx`

**Change-list (keep ALL polling logic, props, `prettify`/`tone`/`resultLabel`, state):**
- [ ] Import from `lucide-react`: `Check`, `X`, `CircleHelp`, `ClipboardCheck`. Import `Reveal` from `@/components/motion/Reveal`.
- [ ] Header: prepend `<ClipboardCheck size={15} className="text-indigo-600"/>` before the "Recruiter view" title.
- [ ] Criteria rows: replace the text `Badge` result with the badge + a leading lucide icon by `tone(c.result)` — `green → <Check size={12}/>`, `rose → <X size={12}/>`, `slate → <CircleHelp size={12}/>` (keep the `resultLabel` text and `Badge` tone).
- [ ] Data tiles (`d.key`): switch the `bg-slate-50` tile to `border border-hairline bg-surface-muted` to match landing cards.
- [ ] Wrap the `ready && analysis` content block in a `<Reveal>` so it fades in when polling completes.
- [ ] Keep the `Spinner` loading + the "still processing" states; just align text tone.

**Constraints:** no change to the analysis polling, `MAX_TRIES`, or `apiAnalysis` usage.

- [ ] **Verify:** `npm run build && npx tsc --noEmit` clean; `npx vitest run` green.
- [ ] **Commit:** `git add src/components/RecruiterPanel.tsx && git commit -m "feat(ui): polish recruiter panel — lucide result icons, card tokens, reveal"`

---

### Task 4: ConfigForm

**Files:** Modify `src/components/ConfigForm.tsx`

**Change-list (keep ALL form state, `submit`, `pickMode`, `effectiveMode`, props, the `Select` component behavior):**
- [ ] Import from `lucide-react`: `Mic`, `MessageSquare`, `ArrowRight`. Import `Reveal` from `@/components/motion/Reveal`.
- [ ] Mode toggle: replace the `🎙 Voice` button content with `<Mic size={15}/> Voice` and `💬 Text` with `<MessageSquare size={15}/> Text` (keep the segmented control structure, the disabled/voiceAvailable logic, and the active/inactive classes).
- [ ] Submit button: replace the inline arrow `<svg>` (lines ~164-166) with `<ArrowRight size={16}/>`. Keep the loading `Spinner` branch unchanged.
- [ ] `Select` chevron `<svg>`: replace with lucide `ChevronDown` (`import { ChevronDown } from "lucide-react"`), same positioning classes.
- [ ] Optional entrance: wrap the returned `<form>` content's top in a single `<Reveal>` is NOT needed (the page already wraps the config step in `animate-rise`); skip to avoid double-animation. Leave layout/spacing as-is unless a token swap (`border-hairline`) reads cleaner on inputs.

**Constraints:** no change to validation, `apiPrepare`, or `onPrepared`.

- [ ] **Verify:** `npm run build && npx tsc --noEmit` clean; `npx vitest run` green.
- [ ] **Commit:** `git add src/components/ConfigForm.tsx && git commit -m "feat(ui): config form — lucide mode toggle + icons"`

---

### Task 5: TextInterview

**Files:** Modify `src/components/TextInterview.tsx`

**Change-list (keep ALL chat state, `send`, `finish`, `apiTurn`, scroll effect, props):**
- [ ] Import from `lucide-react`: `Send`, `Sparkles`. Keep `Spinner`.
- [ ] "Send" button: change label to an icon+label or icon-only — `<Send size={15}/>` (keep `type="submit"`, disabled-on-busy). Keep accessible text (e.g. `aria-label="Send"` if icon-only).
- [ ] Busy indicator: replace the plain `Spinner + "Interviewer is thinking…"` with an animated **typing-dots** affordance (three `motion.span` dots pulsing via the existing `pulse-bar`-style or framer `animate` with staggered delay; reduced-motion → static dots) next to a small `<Sparkles size={14}/>`. Keep the `busy` gate.
- [ ] AI avatar chip ("AI"): keep the gradient chip (it matches the brand); optionally swap the "AI" text for `<Sparkles size={13}/>` — pick whichever reads cleaner, keep gradient.
- [ ] Bubbles/input: align radii to landing; input border → keep, ensure focus ring matches (`focus-visible:ring-indigo-500/40`). No structural change.

**Constraints:** transcript mapping in `finish()` unchanged; `onComplete` unchanged.

- [ ] **Verify:** `npm run build && npx tsc --noEmit` clean; `npx vitest run` green.
- [ ] **Commit:** `git add src/components/TextInterview.tsx && git commit -m "feat(ui): polish text interview — lucide send, animated typing dots"`

---

### Task 6: VoiceInterview + CompetencyRail

**Files:** Modify `src/components/VoiceInterview.tsx`, `src/components/CompetencyRail.tsx`

**VoiceInterview change-list (keep ALL ElevenLabs/Simli logic, `Room`, refs, `start`, `decodeBase64`, props):**
- [ ] Import from `lucide-react`: `Mic`, `PhoneOff`, `Radio`. 
- [ ] Empty state: replace the `🎙` emoji tile (line ~80) with a tile containing `<Mic size={22} className="text-indigo-600"/>` (keep the `bg-indigo-50` rounded tile).
- [ ] Start button: `<Mic size={15}/> Start interview`. End button (danger): `<PhoneOff size={15}/> End & get feedback`.
- [ ] Status line: keep the pulsing dot; optionally prepend `<Radio size={13}/>` when `started`. Keep `convo.isSpeaking` logic and labels.
- [ ] Bubbles match TextInterview after Task 5 (same classes) — keep identical styling for consistency.

**CompetencyRail change-list:**
- [ ] Import `Target` (or `ListChecks`) from `lucide-react`. Replace the `Assessing` header text with `<Target size={13}/> Assessing` (keep the uppercase tracking style). Replace the bullet dot `<span>` with a small `lucide` `Dot`/`Check` OR keep the indigo dot — pick `Check size={13} className="text-indigo-500"` for a "criteria" feel. Keep `Card` + list structure.

**Constraints:** no change to voice session lifecycle, avatar, or webcam behavior.

- [ ] **Verify:** `npm run build && npx tsc --noEmit` clean; `npx vitest run` green.
- [ ] **Commit:** `git add src/components/VoiceInterview.tsx src/components/CompetencyRail.tsx && git commit -m "feat(ui): polish voice interview + competency rail — lucide icons"`

---

### Task 7: Scoring state + Stepper (page.tsx) + Account page

**Files:** Modify `src/app/page.tsx`, `src/app/account/page.tsx`

**page.tsx change-list (keep ALL step state, handlers, `onPrepared`/`onComplete`/`restart`, gating logic):**
- [ ] Scoring loading card (the `step === "scoring"` block): keep the `Spinner` but elevate — wrap in a `Reveal`, add a subtle pulsing accent; keep copy. Import `Reveal`.
- [ ] `Stepper`: replace the numeric circles' completed state with a lucide `Check` (`import { Check } from "lucide-react"`) for steps where `i < idx` (completed), keep the number for current/future. Keep the connector line + labels + logic.
- [ ] Do not alter the hero/config headline block (it mirrors the landing already) beyond ensuring tokens are consistent.

**account/page.tsx change-list (keep the data fetch + states):**
- [ ] Wrap content in the `Card` primitive; add a heading with a lucide `User`/`CreditCard` icon; render the subscription `info` in a clean row. Keep the keyless-mode message. Import `Card` from `@/components/ui` and an icon from `lucide-react`.

**Constraints:** no change to the interview/scoring flow, the entitlement gate, or the subscription query.

- [ ] **Verify:** `npm run build && npx tsc --noEmit` clean; `npx vitest run` green.
- [ ] **Commit:** `git add src/app/page.tsx src/app/account/page.tsx && git commit -m "feat(ui): polish scoring state, stepper checks, account page"`

---

### Task 8: Verify, dogfood, ship

**Files:** none (verification + ship)

- [ ] **Full gates:** `npx tsc --noEmit && npm run lint && npm run build && npx vitest run` — all exit 0; vitest 166 pass (165 + the new easeOutValue tests) / 2 skipped.
- [ ] **Dogfood the real app** (in-app screens render when NOT signed-out): run keyless + stub LLM so the app shows directly without auth, then drive config → text interview → report and screenshot:

```bash
# keyless (no Supabase → app renders directly) + deterministic stub LLM
NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= FAKE_LLM=1 npm run dev
```
Use the `browse` tool: goto `http://localhost:3000`, fill the JD, Start interview (text), answer once, Finish → screenshot the **report**. Read the PNGs to confirm: animated ring/score, lucide icons (no emoji), reveals, premium cards. Verify reduced-motion path doesn't break layout.

- [ ] **Push + PR:** `git push -u origin feat/phase2-inapp-polish` then `gh pr create --base main --title "Phase 2: premium in-app screen polish" --body-file <body>` (body summarizes: scorecard animation, lucide icons everywhere, reveals, no logic changes, tests green; references this spec).
- [ ] **Verify Vercel preview** loads, then **merge to `main`** (prod deploy) and confirm the live app screens render the polish.

---

## Self-Review

**Spec coverage:** ReportView (T2) ✓ · RecruiterPanel (T3) ✓ · ConfigForm (T4) ✓ · TextInterview (T5) ✓ · VoiceInterview + CompetencyRail (T6) ✓ · scoring/stepper/account (T7) ✓ · foundation primitive CountUp (T1) ✓ · tests + dogfood + ship (T8) ✓. All DoD bullets mapped.

**Placeholder scan:** Task 1 has exact code + tests. Tasks 2-7 are deliberately change-lists (polish-to-reference, not net-new) with explicit icon names, exact glyph replacements, motion props, and hard "do not change logic" constraints + per-task verify/commit. No "TBD"/"handle edge cases"/vague steps.

**Type/consistency:** `easeOutValue(t, target)` (T1) used by `CountUp` (T1) used in `ReportView` (T2); `Reveal` import path consistent (`@/components/motion/Reveal`); lucide icon names are real (`Check`, `TriangleAlert`, `ThumbsUp/Down`, `Minus`, `Mic`, `MessageSquare`, `ArrowRight`, `ChevronDown`, `Send`, `Sparkles`, `PhoneOff`, `Radio`, `Target`, `ClipboardCheck`, `X`, `CircleHelp`, `User`, `CreditCard`); no component prop/signature changes anywhere (constraint repeated per task).
