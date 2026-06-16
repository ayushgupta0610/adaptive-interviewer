# Landing + UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare signed-out auth card with an investor-grade marketing landing page, restructure entry (signed-out → landing, signed-in → app), and reprice subscriptions to ₹299 Plus / ₹699 Pro — all on the existing Cashfree subscription system.

**Architecture:** A new `src/components/landing/` of focused presentational components, composed into one `<Landing/>` that `AuthGate` renders for signed-out users. A context-aware header shows a marketing nav when signed-out and the existing status bar when signed-in. Pricing changes are confined to one migration seed + the `Paywall` + one entitlement tweak. Pure logic (entitlement, carousel math, gate decision, pricing data) is TDD'd in the existing node vitest env; presentational components are verified via `build` + visual dogfooding (no DOM test infra added).

**Tech Stack:** Next.js 16 (App Router, **read `node_modules/next/dist/docs/` before editing routes/layout** per `AGENTS.md`), React, Tailwind v4 (`@theme` tokens in `globals.css`), `framer-motion` (motion), `lucide-react` (icons), existing `@/components/ui` primitives (`Button`, `Card`, `Badge`, `Logo`, `cn`), vitest.

**Visual source of truth:** approved mockups on disk at
`.superpowers/brainstorm/42112-1781609720/content/` — `landing-mockup.html`, `scorecard-carousel.html`, `design-directions.html` (Direction A). Read them for exact spacing/color/copy.

**Spec:** `docs/superpowers/specs/2026-06-16-landing-ux-redesign-design.md`

---

## Prerequisite (outside this feature)

The base branch `feat/payments-auth` has **uncommitted test/fix work** from a prior session (new `*.test.ts`, the subscription-activation fix, `vitest.config.ts`, etc.). Commit that first so it doesn't ride into this branch confusingly. Recommended:

```bash
cd /Users/gupta/Downloads/Development/Projects/adaptive-video-tutor
git add src/services/auth.test.ts src/services/billingRepo.test.ts src/app/api/billing/billing.routes.integration.test.ts \
        src/services/billingRepo.ts src/services/payments/cashfree.ts src/services/payments/provider.ts \
        src/services/payments/cashfree.test.ts src/services/rateLimit.test.ts src/core/entitlement.test.ts \
        src/app/api/billing/checkout/route.ts supabase/migrations/0002_payments_auth.sql vitest.config.ts .gitignore
git commit -m "test: cover payments/auth scenarios; fix: persist pending subscription so webhook can activate it"
```

(If you'd rather not, the changes simply carry into the new branch — but commit them as their own commit there before Task 2.)

## File Structure

```
src/components/landing/
  Landing.tsx          # composes all sections (default export)
  LandingNav.tsx       # marketing header (signed-out)
  Hero.tsx             # headline + CTAs + HeroDemo
  HeroDemo.tsx         # auto-playing "live interview" loop card
  HowItWorks.tsx       # 3 steps
  Features.tsx         # 3 feature tiles
  ScorecardCard.tsx    # one role scorecard (presentational)
  ScorecardCarousel.tsx# role pills + slider + dots/arrows
  Pricing.tsx          # Free / Plus / Pro
  FinalCta.tsx         # closing CTA band
  samples.ts           # typed sample scorecard data (logic — tested)
  carousel.ts          # pure index helpers (logic — tested)
  pricing.ts           # pricing tiers data (logic — tested)
  auth-view.ts         # pure gate-view decision (logic — tested)
src/components/motion/
  Reveal.tsx           # framer-motion fade/rise wrapper (reduced-motion safe)
```

Modified: `src/components/AuthGate.tsx`, `src/components/TopBar.tsx`, `src/components/Paywall.tsx`,
`src/core/entitlement.ts` (+ test), `src/app/globals.css`, `supabase/migrations/0002_payments_auth.sql`.

---

### Task 1: Branch + dependencies

**Files:** `package.json` (via npm)

- [ ] **Step 1: Create the feature branch off the payments/auth branch**

```bash
cd /Users/gupta/Downloads/Development/Projects/adaptive-video-tutor
git checkout feat/payments-auth
git checkout -b feat/landing-ux-redesign
```

- [ ] **Step 2: Install motion + icons**

```bash
npm install framer-motion lucide-react
```

- [ ] **Step 3: Verify the project still builds**

Run: `npm run build`
Expected: build completes, exit 0.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add framer-motion + lucide-react for landing redesign"
```

---

### Task 2: Design tokens

Add the semantic + surface tokens the landing/scorecards reference, alongside the existing brand scale.

**Files:** Modify `src/app/globals.css:3-13` (the `@theme inline` block)

- [ ] **Step 1: Extend the `@theme inline` block**

Replace the `@theme inline { ... }` block with:

```css
@theme inline {
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --color-brand-50: #eef2ff;
  --color-brand-100: #e0e7ff;
  --color-brand-500: #6366f1;
  --color-brand-600: #4f46e5;
  --color-brand-700: #4338ca;
  /* semantic scorecard tones */
  --color-good: #15803d;
  --color-good-bg: #dcfce7;
  --color-gap: #b91c1c;
  --color-gap-bg: #fee2e2;
  /* surfaces / borders used across landing */
  --color-surface: #ffffff;
  --color-surface-muted: #f8fafc;
  --color-hairline: #e8eaf0;
  --animate-fade-in: fade-in 0.4s ease both;
  --animate-rise: rise 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: exit 0 (CSS compiles; new tokens available as `bg-surface`, `border-hairline`, etc.).

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(ui): semantic + surface design tokens for the landing"
```

---

### Task 3: Reveal motion primitive

A reusable scroll-reveal wrapper that respects `prefers-reduced-motion`.

**Files:** Create `src/components/motion/Reveal.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  /** Stagger delay in seconds. */
  delay?: number;
  className?: string;
}

/** Fades + rises its children into view once. No motion when the user prefers reduced motion. */
export default function Reveal({ children, delay = 0, className }: RevealProps) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/motion/Reveal.tsx
git commit -m "feat(ui): Reveal motion primitive (reduced-motion safe)"
```

---

### Task 4: Entitlement — active subscribers get unlimited text (pure TDD)

So the landing's "unlimited text" claim is true. Today the daily cap applies to everyone.

**Files:**
- Test: `src/core/entitlement.test.ts` (add cases)
- Modify: `src/core/entitlement.ts:21-37`

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe("canStartSession — edge cases", ...)` block in `src/core/entitlement.test.ts`:

```ts
  it("gives active subscribers unlimited text (bypasses the daily cap)", () => {
    const r = canStartSession({ ...base, mode: "text", freeTextToday: 99, freeTextDailyCap: 5, subscription: { status: "active", quota: 10 } });
    expect(r).toEqual({ allowed: true, reason: "ok", consume: "free_text" });
  });
  it("still caps free (no-subscription) users on text", () => {
    const r = canStartSession({ ...base, mode: "text", freeTextToday: 5, freeTextDailyCap: 5, subscription: null });
    expect(r.allowed).toBe(false);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/core/entitlement.test.ts`
Expected: FAIL on "unlimited text" (currently returns `allowed:false, reason:"text_daily_cap"`).

- [ ] **Step 3: Implement the bypass**

In `src/core/entitlement.ts`, replace the `if (i.mode === "text") { ... }` block (lines 22-26) with:

```ts
  if (i.mode === "text") {
    // Active subscribers get unlimited text; free users are capped per day.
    if (i.subscription && i.subscription.status === "active") {
      return { allowed: true, reason: "ok", consume: "free_text" };
    }
    return i.freeTextToday < i.freeTextDailyCap
      ? { allowed: true, reason: "ok", consume: "free_text" }
      : { allowed: false, reason: "text_daily_cap", consume: "none" };
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/core/entitlement.test.ts`
Expected: PASS (all entitlement cases).

- [ ] **Step 5: Commit**

```bash
git add src/core/entitlement.ts src/core/entitlement.test.ts
git commit -m "feat(billing): active subscribers get unlimited text practice"
```

---

### Task 5: Reprice — plan seed + Paywall

**Files:**
- Modify: `supabase/migrations/0002_payments_auth.sql:48-51` (the plans seed)
- Modify: `src/components/Paywall.tsx:26-31`

- [ ] **Step 1: Update the plans seed (idempotent upsert so re-apply updates prices)**

Replace lines 48-51 of `supabase/migrations/0002_payments_auth.sql`:

```sql
insert into plans (id, name, price_inr, monthly_session_quota) values
  ('starter','Plus',299,3),
  ('pro','Pro',699,10)
on conflict (id) do update set
  name = excluded.name,
  price_inr = excluded.price_inr,
  monthly_session_quota = excluded.monthly_session_quota;
```

- [ ] **Step 2: Update the Paywall prices**

In `src/components/Paywall.tsx`, replace the button block (lines 26-31):

```tsx
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button variant="secondary" onClick={() => void buy("starter")}>
          Plus ₹299 / mo
        </Button>
        <Button onClick={() => void buy("pro")}>Pro ₹699 / mo</Button>
      </div>
```

- [ ] **Step 3: Verify build + existing tests**

Run: `npm run build && npx vitest run`
Expected: exit 0; tests green.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_payments_auth.sql src/components/Paywall.tsx
git commit -m "feat(billing): reprice to Plus ₹299 / Pro ₹699"
```

---

### Task 6: Landing sample data (TDD)

Typed sample scorecards for the carousel — clearly sample data, not real users.

**Files:**
- Create: `src/components/landing/samples.ts`
- Test: `src/components/landing/samples.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { ROLE_SAMPLES } from "./samples";

describe("ROLE_SAMPLES", () => {
  it("has at least 4 roles with unique ids", () => {
    expect(ROLE_SAMPLES.length).toBeGreaterThanOrEqual(4);
    const ids = ROLE_SAMPLES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("each role has 3 competencies (0–5) and a strength + gap note", () => {
    for (const r of ROLE_SAMPLES) {
      expect(r.competencies).toHaveLength(3);
      for (const c of r.competencies) {
        expect(c.score).toBeGreaterThanOrEqual(0);
        expect(c.score).toBeLessThanOrEqual(5);
      }
      expect(r.strength.length).toBeGreaterThan(0);
      expect(r.gap.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/landing/samples.test.ts`
Expected: FAIL ("Cannot find module './samples'").

- [ ] **Step 3: Implement the data**

```ts
export interface Competency {
  label: string;
  /** 0–5 rubric score. */
  score: number;
}
export interface RoleSample {
  id: string;
  role: string;
  competencies: Competency[];
  strength: string;
  gap: string;
}

/** Sample scorecards shown on the marketing carousel. Illustrative, not real user data. */
export const ROLE_SAMPLES: RoleSample[] = [
  {
    id: "backend",
    role: "Backend Engineer · Senior",
    competencies: [
      { label: "System design", score: 4.2 },
      { label: "Communication", score: 3.6 },
      { label: "Trade-off reasoning", score: 3.1 },
    ],
    strength: "Strong on partitioning; gave a concrete rebalancing strategy with backpressure.",
    gap: "Glossed over failure modes. Practice naming the trade-off you're rejecting and why.",
  },
  {
    id: "pm",
    role: "Product Manager",
    competencies: [
      { label: "Product sense", score: 3.9 },
      { label: "Prioritization", score: 4.1 },
      { label: "Stakeholder comms", score: 3.4 },
    ],
    strength: "Framed the problem around a measurable user outcome before jumping to features.",
    gap: "Prioritization rationale stayed qualitative — tie it to an explicit impact/effort call.",
  },
  {
    id: "data",
    role: "Data Scientist",
    competencies: [
      { label: "ML fundamentals", score: 4.0 },
      { label: "Experiment design", score: 3.3 },
      { label: "Communication", score: 3.7 },
    ],
    strength: "Chose an appropriate baseline and justified the metric for the business question.",
    gap: "Didn't address leakage in the proposed validation split — call it out proactively.",
  },
  {
    id: "design",
    role: "UX Designer",
    competencies: [
      { label: "Craft", score: 4.3 },
      { label: "Process", score: 3.5 },
      { label: "Systems thinking", score: 3.2 },
    ],
    strength: "Connected the visual decision back to a concrete usability hypothesis.",
    gap: "Skipped how you'd validate with users — name the test and the signal you'd watch.",
  },
  {
    id: "ae",
    role: "Account Executive",
    competencies: [
      { label: "Discovery", score: 3.8 },
      { label: "Objection handling", score: 4.0 },
      { label: "Closing", score: 3.4 },
    ],
    strength: "Reframed a price objection around value and quantified the cost of inaction.",
    gap: "Next step at the end was vague — propose a specific, time-bound mutual action.",
  },
];
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/components/landing/samples.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/landing/samples.ts src/components/landing/samples.test.ts
git commit -m "feat(landing): typed role scorecard sample data"
```

---

### Task 7: ScorecardCard (presentational)

**Files:** Create `src/components/landing/ScorecardCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
import type { RoleSample } from "./samples";

const BAR_COLORS = ["bg-indigo-600", "bg-indigo-500", "bg-indigo-400"];

/** One sample scorecard: role · competency bars · strength + gap notes. */
export default function ScorecardCard({ sample }: { sample: RoleSample }) {
  return (
    <div className="flex flex-wrap gap-5 rounded-2xl border border-hairline bg-surface-muted p-5">
      <div className="min-w-[190px] flex-1">
        <div className="mb-3 text-sm font-bold text-slate-900">{sample.role}</div>
        <div className="flex flex-col gap-2.5">
          {sample.competencies.map((c, i) => (
            <div key={c.label}>
              <div className="mb-1 flex justify-between text-xs text-slate-600">
                <span>{c.label}</span>
                <span className="font-semibold text-indigo-600">{c.score.toFixed(1)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200">
                <div className={`h-1.5 rounded-full ${BAR_COLORS[i % 3]}`} style={{ width: `${(c.score / 5) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex min-w-[200px] flex-1 flex-col gap-2.5">
        <div className="rounded-xl border border-hairline bg-white p-3">
          <span className="mb-1.5 inline-block rounded-full bg-good-bg px-2 py-0.5 text-[11px] font-medium text-good">Strength</span>
          <p className="m-0 text-[13px] leading-snug text-slate-600">{sample.strength}</p>
        </div>
        <div className="rounded-xl border border-hairline bg-white p-3">
          <span className="mb-1.5 inline-block rounded-full bg-gap-bg px-2 py-0.5 text-[11px] font-medium text-gap">Gap</span>
          <p className="m-0 text-[13px] leading-snug text-slate-600">{sample.gap}</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/ScorecardCard.tsx
git commit -m "feat(landing): ScorecardCard component"
```

---

### Task 8: Carousel index helpers (TDD) + ScorecardCarousel

**Files:**
- Create: `src/components/landing/carousel.ts`
- Test: `src/components/landing/carousel.test.ts`
- Create: `src/components/landing/ScorecardCarousel.tsx`

- [ ] **Step 1: Write the failing test for the index math**

```ts
import { describe, it, expect } from "vitest";
import { nextIndex, prevIndex } from "./carousel";

describe("carousel index helpers", () => {
  it("nextIndex wraps around", () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
  });
  it("prevIndex wraps around", () => {
    expect(prevIndex(0, 3)).toBe(2);
    expect(prevIndex(2, 3)).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/landing/carousel.test.ts`
Expected: FAIL ("Cannot find module './carousel'").

- [ ] **Step 3: Implement the helpers**

```ts
/** Next index with wrap-around. */
export function nextIndex(i: number, len: number): number {
  return (i + 1) % len;
}
/** Previous index with wrap-around. */
export function prevIndex(i: number, len: number): number {
  return (i - 1 + len) % len;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/components/landing/carousel.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the carousel component**

```tsx
"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ROLE_SAMPLES } from "./samples";
import { nextIndex, prevIndex } from "./carousel";
import ScorecardCard from "./ScorecardCard";
import { cn } from "@/components/ui";

/** Role pills + a single-card slider with arrows + dots. */
export default function ScorecardCarousel() {
  const [i, setI] = useState(0);
  const len = ROLE_SAMPLES.length;
  const active = ROLE_SAMPLES[i];
  return (
    <div className="rounded-2xl border border-hairline bg-white p-6 shadow-sm shadow-slate-200/50">
      <h3 className="text-2xl font-bold tracking-tight text-slate-900">See exactly where you stand — for any role</h3>
      <p className="mb-4 mt-1 text-sm text-slate-500">Every interview ends in a recruiter-grade report. Pick a role to see a sample.</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {ROLE_SAMPLES.map((r, idx) => (
          <button
            key={r.id}
            onClick={() => setI(idx)}
            aria-pressed={idx === i}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              idx === i ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            )}
          >
            {r.role.split(" · ")[0]}
          </button>
        ))}
      </div>

      <ScorecardCard sample={active} />

      <div className="mt-4 flex items-center justify-center gap-3.5">
        <button onClick={() => setI((c) => prevIndex(c, len))} aria-label="Previous role"
          className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40">
          <ChevronLeft size={16} />
        </button>
        <div className="flex gap-1.5">
          {ROLE_SAMPLES.map((r, idx) => (
            <span key={r.id} className={cn("h-1.5 rounded-full transition-all", idx === i ? "w-5 bg-indigo-600" : "w-1.5 bg-slate-300")} />
          ))}
        </div>
        <button onClick={() => setI((c) => nextIndex(c, len))} aria-label="Next role"
          className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/landing/carousel.ts src/components/landing/carousel.test.ts src/components/landing/ScorecardCarousel.tsx
git commit -m "feat(landing): role scorecard carousel"
```

---

### Task 9: Hero + HeroDemo loop

**Files:**
- Create: `src/components/landing/HeroDemo.tsx`
- Create: `src/components/landing/Hero.tsx`

- [ ] **Step 1: Create the auto-playing demo card**

`HeroDemo.tsx` — cycles through interviewer prompts with an animated waveform; static (final prompt) under reduced motion.

```tsx
"use client";
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

const PROMPTS = [
  "Walk me through a system you designed for scale.",
  "You mentioned sharding — how did you rebalance without downtime?",
  "What failure modes worried you, and how did you mitigate them?",
];
const BARS = [40, 75, 100, 55, 88, 35, 64, 48];

export default function HeroDemo() {
  const reduce = useReducedMotion();
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % PROMPTS.length), 3200);
    return () => clearInterval(t);
  }, [reduce]);

  return (
    <div className="rounded-2xl border border-hairline bg-white p-4 shadow-xl shadow-slate-300/30">
      <div className="mb-2.5 flex items-center gap-2 text-xs text-slate-400">
        <span className="h-2 w-2 rounded-full bg-rose-400" />
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="ml-auto">● Live · 04:12</span>
      </div>
      <div className="text-xs font-semibold text-indigo-600">Interviewer</div>
      <p className="mb-1 mt-1 min-h-[40px] text-[13px] leading-snug text-slate-700">{PROMPTS[idx]}</p>
      <div className="my-2.5 flex h-[34px] items-end gap-[3px]">
        {BARS.map((h, i) => (
          <span
            key={i}
            className="w-1 rounded-full bg-indigo-400"
            style={{
              height: `${h}%`,
              animation: reduce ? undefined : `pulse-bar 1.1s ease-in-out ${i * 0.08}s infinite alternate`,
            }}
          />
        ))}
      </div>
      <div className="border-t border-slate-100 pt-2 text-[11px] text-slate-400">↳ adapts to your last answer · follow-up auto-generated</div>
    </div>
  );
}
```

Also add the keyframe to `src/app/globals.css` (after the existing `@keyframes rise` block):

```css
@keyframes pulse-bar {
  from { transform: scaleY(0.6); opacity: 0.7; }
  to { transform: scaleY(1); opacity: 1; }
}
```

- [ ] **Step 2: Create the Hero**

`Hero.tsx`:

```tsx
"use client";
import { Button } from "@/components/ui";
import Reveal from "@/components/motion/Reveal";
import HeroDemo from "./HeroDemo";

export default function Hero({ onStart }: { onStart: () => void }) {
  return (
    <section className="mx-auto grid w-full max-w-5xl items-center gap-9 px-6 py-16 md:grid-cols-[1.1fr_1fr]">
      <Reveal>
        <div>
          <span className="mb-4 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            ⚡ Voice-first AI mock interviews
          </span>
          <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl">
            Practice the interview <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">before it counts.</span>
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-lg text-slate-500">
            Paste any job description. A voice AI runs a real mock interview, adapts to your answers in real time, and scores you like a hiring panel would.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" onClick={onStart}>Start your free interview →</Button>
            <Button size="lg" variant="secondary" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>
              See how it works
            </Button>
          </div>
          <p className="mt-3.5 text-xs text-slate-400">Your first voice interview is free · No credit card · ~10 min</p>
        </div>
      </Reveal>
      <Reveal delay={0.1}>
        <HeroDemo />
      </Reveal>
    </section>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/Hero.tsx src/components/landing/HeroDemo.tsx src/app/globals.css
git commit -m "feat(landing): hero with auto-playing live-interview demo"
```

---

### Task 10: HowItWorks + Features

**Files:**
- Create: `src/components/landing/HowItWorks.tsx`
- Create: `src/components/landing/Features.tsx`

- [ ] **Step 1: HowItWorks**

```tsx
import Reveal from "@/components/motion/Reveal";

const STEPS = [
  { n: 1, title: "Paste the job description", body: "Any role, any seniority. We build a tailored competency rubric from it." },
  { n: 2, title: "Get interviewed by voice", body: "A realtime AI interviewer asks, listens, and digs deeper based on your answers." },
  { n: 3, title: "Get scored like a panel", body: "A rubric-based scorecard with strengths, gaps, and exactly what to fix." },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.08}>
            <div className="h-full rounded-2xl border border-hairline bg-white p-5">
              <div className="mb-2.5 grid h-7 w-7 place-items-center rounded-full bg-indigo-600 text-sm font-semibold text-white">{s.n}</div>
              <h3 className="font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-1 text-[13px] leading-snug text-slate-500">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Features**

```tsx
import { GitBranch, Mic, Target } from "lucide-react";
import Reveal from "@/components/motion/Reveal";

const FEATURES = [
  { icon: GitBranch, title: "Truly adaptive", body: "Follow-ups are generated from your actual answers — not a fixed script." },
  { icon: Mic, title: "Voice-first realism", body: "Real-time speech with the pressure and pacing of an actual interview." },
  { icon: Target, title: "JD-tailored rubric", body: "Scored on the competencies that role actually screens for." },
];

export default function Features() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.08}>
            <div className="h-full rounded-2xl border border-hairline bg-white p-5">
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-indigo-600">
                <f.icon size={18} />
              </div>
              <h3 className="font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-[13px] leading-snug text-slate-500">{f.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/HowItWorks.tsx src/components/landing/Features.tsx
git commit -m "feat(landing): how-it-works + feature sections"
```

---

### Task 11: Pricing (TDD data + component)

**Files:**
- Create: `src/components/landing/pricing.ts`
- Test: `src/components/landing/pricing.test.ts`
- Create: `src/components/landing/Pricing.tsx`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { TIERS } from "./pricing";

describe("pricing TIERS", () => {
  it("has Free, Plus (starter), Pro (pro)", () => {
    expect(TIERS.map((t) => t.id)).toEqual(["free", "starter", "pro"]);
  });
  it("only paid tiers carry a checkout id matching the API enum", () => {
    const paid = TIERS.filter((t) => t.checkoutId);
    expect(paid.map((t) => t.checkoutId)).toEqual(["starter", "pro"]);
    expect(TIERS.find((t) => t.id === "free")?.checkoutId).toBeUndefined();
  });
  it("prices match the repriced plan (₹299 / ₹699)", () => {
    expect(TIERS.find((t) => t.id === "starter")?.priceInr).toBe(299);
    expect(TIERS.find((t) => t.id === "pro")?.priceInr).toBe(699);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/landing/pricing.test.ts`
Expected: FAIL ("Cannot find module './pricing'").

- [ ] **Step 3: Implement the data**

```ts
export interface PricingTier {
  id: "free" | "starter" | "pro";
  name: string;
  priceInr: number;
  blurb: string;
  features: string[];
  cta: string;
  /** Only paid tiers — matches the checkout API enum. */
  checkoutId?: "starter" | "pro";
  featured?: boolean;
}

export const TIERS: PricingTier[] = [
  { id: "free", name: "Free", priceInr: 0, blurb: "Try it, no card.", features: ["1 free voice interview", "Daily text practice", "Full scorecards"], cta: "Start free" },
  { id: "starter", name: "Plus", priceInr: 299, blurb: "For active job seekers.", features: ["3 voice interviews / mo", "Unlimited text practice", "Full scorecards"], cta: "Choose Plus", checkoutId: "starter" },
  { id: "pro", name: "Pro", priceInr: 699, blurb: "For serious prep.", features: ["10 voice interviews / mo", "Unlimited text practice", "Priority models"], cta: "Choose Pro", checkoutId: "pro", featured: true },
];
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/components/landing/pricing.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the component**

```tsx
"use client";
import { Check } from "lucide-react";
import { Button, cn } from "@/components/ui";
import Reveal from "@/components/motion/Reveal";
import { apiCheckout } from "@/lib/api";
import { TIERS } from "./pricing";

export default function Pricing({ onFree }: { onFree: () => void }) {
  async function choose(checkoutId?: "starter" | "pro") {
    if (!checkoutId) return onFree();
    const { url } = await apiCheckout(checkoutId);
    window.location.href = url;
  }
  return (
    <section id="pricing" className="mx-auto w-full max-w-5xl px-6 py-14">
      <Reveal>
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">Simple, honest pricing</h2>
        <p className="mb-8 mt-1 text-center text-sm text-slate-500">Start free. Voice interviews cost us real money — so we price them fairly, not for free.</p>
      </Reveal>
      <div className="grid gap-4 sm:grid-cols-3">
        {TIERS.map((t, i) => (
          <Reveal key={t.id} delay={i * 0.07}>
            <div className={cn("flex h-full flex-col rounded-2xl border bg-white p-5", t.featured ? "border-2 border-indigo-600 shadow-lg shadow-indigo-600/10" : "border-hairline")}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">{t.name}</span>
                {t.featured && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">Popular</span>}
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {t.priceInr === 0 ? "₹0" : `₹${t.priceInr}`}<span className="text-[13px] font-medium text-slate-400">{t.priceInr === 0 ? "" : "/mo"}</span>
              </div>
              <p className="mt-0.5 text-[13px] text-slate-500">{t.blurb}</p>
              <ul className="my-4 flex flex-1 flex-col gap-2 text-[13px] text-slate-600">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2"><Check size={15} className="mt-0.5 shrink-0 text-indigo-600" />{f}</li>
                ))}
              </ul>
              <Button variant={t.featured ? "primary" : "secondary"} className="w-full" onClick={() => void choose(t.checkoutId)}>{t.cta}</Button>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Verify build + tests**

Run: `npm run build && npx vitest run`
Expected: exit 0; green.

- [ ] **Step 7: Commit**

```bash
git add src/components/landing/pricing.ts src/components/landing/pricing.test.ts src/components/landing/Pricing.tsx
git commit -m "feat(landing): pricing section (Free / Plus ₹299 / Pro ₹699)"
```

---

### Task 12: LandingNav + FinalCta + context-aware TopBar

**Files:**
- Create: `src/components/landing/LandingNav.tsx`
- Create: `src/components/landing/FinalCta.tsx`
- Modify: `src/components/TopBar.tsx`

- [ ] **Step 1: LandingNav**

```tsx
"use client";
import { Logo, Badge, Button } from "@/components/ui";

export default function LandingNav({ onStart }: { onStart: () => void }) {
  const scrollTo = (id: string) => () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  return (
    <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-6">
      <Logo />
      <Badge tone="indigo">Beta</Badge>
      <nav className="ml-auto flex items-center gap-4 text-sm font-medium text-slate-600">
        <button className="hidden hover:text-slate-900 sm:inline" onClick={scrollTo("how-it-works")}>How it works</button>
        <button className="hidden hover:text-slate-900 sm:inline" onClick={scrollTo("pricing")}>Pricing</button>
        <Button size="md" onClick={onStart}>Start free</Button>
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: FinalCta**

```tsx
"use client";
import { Button } from "@/components/ui";
import Reveal from "@/components/motion/Reveal";

export default function FinalCta({ onStart }: { onStart: () => void }) {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pb-16">
      <Reveal>
        <div className="rounded-2xl bg-gradient-to-b from-surface-muted to-brand-50 px-6 py-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Walk in ready.</h2>
          <p className="mb-5 mt-1 text-sm text-slate-500">Your first voice interview is on us.</p>
          <Button size="lg" onClick={onStart}>Continue with Google →</Button>
        </div>
      </Reveal>
    </section>
  );
}
```

- [ ] **Step 3: Make TopBar context-aware**

Replace the entire body of `src/components/TopBar.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { apiStatus, type StatusResponse } from "@/lib/api";
import { Logo, Badge } from "@/components/ui";
import { useAccessToken } from "@/components/AuthGate";
import { isSupabaseConfigured, supabaseBrowser } from "@/lib/supabaseBrowser";
import LandingNav from "@/components/landing/LandingNav";

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="group relative flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]" : "bg-slate-300"}`} />
      <span className="hidden text-xs text-slate-500 sm:inline">{label}</span>
    </span>
  );
}

function startGoogle() {
  supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
}

export default function TopBar() {
  const token = useAccessToken();
  const [s, setS] = useState<StatusResponse | null>(null);
  useEffect(() => {
    apiStatus().then(setS).catch(() => setS(null));
  }, []);

  // Signed-out + Supabase configured → marketing nav. Otherwise the app/status bar.
  const showLanding = isSupabaseConfigured && token === null;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/70 backdrop-blur-md">
      {showLanding ? (
        <LandingNav onStart={startGoogle} />
      ) : (
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <Logo />
            <Badge tone="indigo">Beta</Badge>
          </div>
          {s && (
            <div className="flex items-center gap-4">
              <StatusDot ok={s.openrouter} label={s.fakeLlm ? "Stub LLM" : "LLM"} />
              <StatusDot ok={s.elevenlabs} label="Voice" />
              <StatusDot ok={s.supabase} label="Data" />
            </div>
          )}
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/landing/LandingNav.tsx src/components/landing/FinalCta.tsx src/components/TopBar.tsx
git commit -m "feat(landing): marketing nav + final CTA + context-aware TopBar"
```

---

### Task 13: Gate-view decision (TDD) + assemble Landing + wire into AuthGate

**Files:**
- Create: `src/components/landing/auth-view.ts`
- Test: `src/components/landing/auth-view.test.ts`
- Create: `src/components/landing/Landing.tsx`
- Modify: `src/components/AuthGate.tsx`

- [ ] **Step 1: Write the failing test for the gate decision**

```ts
import { describe, it, expect } from "vitest";
import { gateView } from "./auth-view";

describe("gateView", () => {
  it("keyless/demo mode always shows the app", () => {
    expect(gateView(false, null)).toBe("app");
    expect(gateView(false, "demo")).toBe("app");
  });
  it("configured + no token shows the landing", () => {
    expect(gateView(true, null)).toBe("landing");
  });
  it("configured + token shows the app", () => {
    expect(gateView(true, "jwt")).toBe("app");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/landing/auth-view.test.ts`
Expected: FAIL ("Cannot find module './auth-view'").

- [ ] **Step 3: Implement the helper**

```ts
export type GateView = "app" | "landing";

/** Decide what a visitor sees: the app (keyless/demo or signed-in) or the landing (signed-out). */
export function gateView(isConfigured: boolean, token: string | null): GateView {
  if (!isConfigured) return "app";
  return token ? "app" : "landing";
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/components/landing/auth-view.test.ts`
Expected: PASS.

- [ ] **Step 5: Compose the Landing page**

```tsx
"use client";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Hero from "./Hero";
import HowItWorks from "./HowItWorks";
import ScorecardCarousel from "./ScorecardCarousel";
import Features from "./Features";
import Pricing from "./Pricing";
import FinalCta from "./FinalCta";

function startGoogle() {
  supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
}

/** Public marketing page shown to signed-out visitors. CTAs trigger Google OAuth. */
export default function Landing() {
  return (
    <div className="flex-1">
      <Hero onStart={startGoogle} />
      <HowItWorks />
      <section className="mx-auto w-full max-w-5xl px-6 py-12">
        <ScorecardCarousel />
      </section>
      <Features />
      <Pricing onFree={startGoogle} />
      <FinalCta onStart={startGoogle} />
    </div>
  );
}
```

- [ ] **Step 6: Wire Landing into AuthGate**

Replace the signed-out return in `src/components/AuthGate.tsx` (the `return (<Card ...>...</Card>)` block, lines 47-62) with a `gateView`-driven branch. The full new `AuthGate` function:

```tsx
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const token = useAccessToken();
  if (gateView(isSupabaseConfigured, token) === "app") return <>{children}</>;
  return <Landing />;
}
```

Add the imports at the top of `AuthGate.tsx`:

```tsx
import { gateView } from "@/components/landing/auth-view";
import Landing from "@/components/landing/Landing";
```

Remove the now-unused `Button, Card` import if nothing else in the file uses them (the `useAccessToken` hook and `isSupabaseConfigured` import stay). Verify `Card`/`Button` are not referenced elsewhere in the file before removing.

- [ ] **Step 7: Verify build + full test suite**

Run: `npm run build && npx vitest run`
Expected: exit 0; all tests green (155+ existing + new logic tests).

- [ ] **Step 8: Commit**

```bash
git add src/components/landing/auth-view.ts src/components/landing/auth-view.test.ts src/components/landing/Landing.tsx src/components/AuthGate.tsx
git commit -m "feat(landing): assemble landing + show it to signed-out visitors"
```

---

### Task 14: Verify gates, responsive/a11y/reduced-motion, deploy preview

**Files:** none (verification + manual)

- [ ] **Step 1: Full gate check**

Run: `npx tsc --noEmit && npm run lint && npm run build && npx vitest run`
Expected: all exit 0; tests green.

- [ ] **Step 2: Local visual dogfood (signed-out landing)**

Run: `npm run dev`, open `http://localhost:3000`. With Supabase env set you see the **landing**; resize to 375px width and confirm: hero stacks, carousel is one card, pricing stacks, nav collapses (links hidden on mobile, "Start free" stays). Toggle OS "Reduce Motion" and reload — hero demo freezes on one prompt, no waveform animation, Reveal sections show their final state.

- [ ] **Step 3: Verify the signed-in path is unchanged**

Sign in with Google → you should drop straight into the existing config/interview app (the in-page hero + `ConfigForm`), header shows the status dots. Trigger a quota-exceeded state (or temporarily force `paywallReason`) and confirm the **repriced** Paywall (₹299 / ₹699) renders.

- [ ] **Step 4: Keyless/demo sanity**

Temporarily unset `NEXT_PUBLIC_SUPABASE_URL` (or run a keyless env) and confirm the app renders directly (no landing, no auth wall) — preserves the demo flow.

- [ ] **Step 5: Deploy a Vercel preview and click through**

Push the branch and open the PR's Vercel **preview** URL (do not touch production). Verify the landing loads fast and the "Start free / Continue with Google" CTA initiates OAuth and returns to the app.

```bash
git push -u origin feat/landing-ux-redesign
```

- [ ] **Step 6: Open the PR**

```bash
gh pr create --base feat/payments-auth --title "Landing + UX redesign (Direction A) + reprice ₹299/₹699" --body "Implements docs/superpowers/specs/2026-06-16-landing-ux-redesign-design.md. Public marketing landing for signed-out visitors; signed-in users unchanged; subscriptions repriced to Plus ₹299 / Pro ₹699; active subscribers get unlimited text. In-app screen polish deferred to Phase 2."
```

---

## Self-Review

**Spec coverage:**
- Landing page (nav/hero+demo/how-it-works/carousel/features/pricing/final CTA) → Tasks 7–13 ✓
- Entry restructure (signed-out→landing, signed-in→app, keyless→app) → Tasks 12–13 (`gateView`, `AuthGate`, `TopBar`) ✓
- Reprice on Cashfree (Free/Plus ₹299/Pro ₹699) → Task 5 (+ Task 11 display) ✓
- "Unlimited text" honesty (entitlement bypass) → Task 4 ✓
- Design-system foundation (tokens, motion, icons) → Tasks 1–3 ✓
- Product-as-proof carousel, no fabricated proof → Tasks 6–8 (sample data clearly illustrative) ✓
- Accessibility/responsive/reduced-motion → Tasks 3, 8, 9, 14 ✓
- Phase-2 in-app polish explicitly out of scope ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every test step shows the assertion and the run command + expected result. ✓

**Type consistency:** `RoleSample`/`Competency` (Task 6) used by `ScorecardCard` (7) and `ScorecardCarousel` (8); `nextIndex`/`prevIndex` (8) match usage; `PricingTier.checkoutId: "starter"|"pro"` (11) matches `apiCheckout(planId: "starter"|"pro")` and `Pricing.choose`; `gateView(isConfigured, token)` (13) matches `AuthGate` call; `useAccessToken` imported into `TopBar` from `AuthGate` where it is exported. ✓

**Notes for the implementer:** Tasks 6, 8, 11, 13 are pure-logic TDD (node vitest, no DOM). Presentational components (7, 9, 10, 12) are verified by `build` + the Task 14 visual pass — no DOM test infra is added on purpose. Match exact spacing/copy against the mockups in `.superpowers/brainstorm/42112-1781609720/content/`.
