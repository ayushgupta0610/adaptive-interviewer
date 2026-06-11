# Payments + Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate interviews behind real accounts (Supabase + Google OAuth) and charge for voice/avatar sessions via a monthly Cashfree subscription, with a free text tier and one free voice+avatar trial — at ≥25% margin.

**Architecture:** Three isolated concerns. (1) **Auth** — Supabase Google OAuth; every session tied to `auth.uid()`. (2) **Entitlement** — a pure function `canStartSession()` decides allow/deny from trial + subscription + usage; enforced by a `/api/session/start` gate that all interviews must pass. (3) **Billing** — a `PaymentProvider` adapter (Cashfree impl) creates subscription checkouts; signed, idempotent webhooks are the source of truth and mirror subscription state into Supabase.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + Auth + RLS), `@supabase/supabase-js` + `@supabase/ssr`, Cashfree Subscriptions API, Upstash Redis (durable rate limiting), zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-11-payments-auth-design.md`. **Unit economics:** `src/lib/cost.ts`, `docs/unit-economics.md`.

---

## File structure

**New:**
- `supabase/migrations/0002_payments_auth.sql` — profiles, plans, subscriptions, sessions columns, RLS, seed plans.
- `src/domain/billing.ts` — Plan / Subscription / status types + zod schemas.
- `src/core/entitlement.ts` (+ `.test.ts`) — pure `canStartSession()`.
- `src/services/auth.ts` (+ `.test.ts` for the parser) — verify Supabase JWT → userId (server).
- `src/services/billingRepo.ts` — profiles/subscriptions/usage queries (service role).
- `src/services/payments/provider.ts` — `PaymentProvider` port + `BillingEvent` type.
- `src/services/payments/cashfree.ts` (+ `.test.ts`) — Cashfree checkout + webhook verify.
- `src/services/redisRateLimit.ts` — Upstash-backed limiter (falls back to in-memory).
- `src/app/api/session/start/route.ts` — entitlement gate + usage consume.
- `src/app/api/billing/checkout/route.ts` — create subscription checkout.
- `src/app/api/billing/webhook/route.ts` — Cashfree webhook → update subscription.
- `src/lib/supabaseBrowser.ts` — browser Supabase client (Google OAuth).
- `src/components/AuthGate.tsx`, `src/components/Paywall.tsx`, `src/app/account/page.tsx`.

**Modified:**
- `src/services/env.ts` — Cashfree + Upstash + auth env.
- `src/services/rateLimit.ts` — route limiter calls through the durable limiter.
- `src/app/api/interview/{prepare,turn,score}/route.ts` + `simli/session/route.ts` — require auth.
- `src/app/page.tsx`, `src/components/ConfigForm.tsx` — call `/api/session/start` before an interview; show paywall on deny.
- `.env.example` — new vars.

---

## Task 1: Billing + auth env vars

**Files:**
- Modify: `src/services/env.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add vars to the env schema**

In `src/services/env.ts`, add inside `EnvSchema`:

```ts
  CASHFREE_APP_ID: z.string().min(1).optional(),
  CASHFREE_SECRET_KEY: z.string().min(1).optional(),
  CASHFREE_WEBHOOK_SECRET: z.string().min(1).optional(),
  CASHFREE_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  FREE_TEXT_DAILY_CAP: z.coerce.number().int().min(0).default(5),
```

Add to the `EnvSchema.parse({...})` object the matching `process.env.*` entries, then add flags:

```ts
export const hasCashfree = !!env.CASHFREE_APP_ID && !!env.CASHFREE_SECRET_KEY;
export const hasUpstash = !!env.UPSTASH_REDIS_REST_URL && !!env.UPSTASH_REDIS_REST_TOKEN;
```

- [ ] **Step 2: Document in `.env.example`**

```
# --- Auth: uses the existing NEXT_PUBLIC_SUPABASE_* + enable Google in Supabase Auth ---
# --- Cashfree (payments) ---
CASHFREE_APP_ID=
CASHFREE_SECRET_KEY=
CASHFREE_WEBHOOK_SECRET=
CASHFREE_ENV=sandbox
# --- Upstash Redis (durable rate limiting) ---
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
FREE_TEXT_DAILY_CAP=5
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` → Expected: no errors.
```bash
git add src/services/env.ts .env.example && git commit -m "feat(billing): env config for Cashfree, Upstash, free-text cap"
```

---

## Task 2: Supabase schema — profiles, plans, subscriptions, usage

**Files:**
- Create: `supabase/migrations/0002_payments_auth.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Profiles: one row per auth user; tracks the one-time free trial.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  free_trial_used boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists plans (
  id text primary key,                 -- 'starter' | 'pro'
  name text not null,
  price_inr integer not null,
  monthly_session_quota integer not null,
  provider_plan_id text,               -- Cashfree plan id
  active boolean not null default true
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references plans(id),
  provider text not null default 'cashfree',
  provider_subscription_id text unique,
  status text not null default 'active',  -- active|past_due|cancelled|expired
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on subscriptions(user_id);

-- Per-session metering on the existing sessions table.
alter table sessions add column if not exists mode text;             -- 'text' | 'voice'
alter table sessions add column if not exists est_cost_usd numeric;  -- from src/lib/cost.ts
alter table sessions add column if not exists billed_as text;        -- 'free_trial'|'subscription'|'free_text'

alter table profiles enable row level security;
alter table plans enable row level security;
alter table subscriptions enable row level security;

drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for select to authenticated using (id = auth.uid());
drop policy if exists plans_read on plans;
create policy plans_read on plans for select to authenticated using (true);
drop policy if exists subscriptions_self on subscriptions;
create policy subscriptions_self on subscriptions for select to authenticated using (user_id = auth.uid());
-- Writes to profiles/subscriptions happen via the service role (gating + webhooks), which bypasses RLS.

insert into plans (id, name, price_inr, monthly_session_quota) values
  ('starter','Starter',999,4),
  ('pro','Pro',1999,10)
on conflict (id) do nothing;

-- Create a profile row automatically on signup.
create or replace function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
```

- [ ] **Step 2: Apply + verify (manual — Supabase SQL editor)**

Paste the migration into the Supabase SQL editor and run. Then verify in the editor:
Run: `select id, monthly_session_quota from plans;`
Expected: rows `starter|4`, `pro|10`.
Enable **Google** provider in Supabase → Authentication → Providers.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_payments_auth.sql && git commit -m "feat(billing): profiles/plans/subscriptions schema + RLS + seed plans"
```

---

## Task 3: Billing domain types

**Files:**
- Create: `src/domain/billing.ts`

- [ ] **Step 1: Write the types/schemas**

```ts
import { z } from "zod";

export const SubscriptionStatusSchema = z.enum(["active", "past_due", "cancelled", "expired"]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export interface Plan {
  id: string;
  name: string;
  priceInr: number;
  monthlySessionQuota: number;
  providerPlanId: string | null;
}

export interface Subscription {
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  monthlyQuota: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}

/** Normalized billing webhook event (provider-agnostic). */
export interface BillingEvent {
  type: "subscription_active" | "subscription_charged" | "subscription_cancelled" | "subscription_expired" | "ignored";
  providerSubscriptionId: string | null;
  eventId: string; // for idempotency
  currentPeriodEnd?: string;
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → Expected: no errors.
```bash
git add src/domain/billing.ts && git commit -m "feat(billing): domain types"
```

---

## Task 4: Entitlement logic (pure, TDD)

**Files:**
- Create: `src/core/entitlement.ts`
- Test: `src/core/entitlement.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { canStartSession } from "./entitlement";

const base = { freeTrialUsed: false, subscription: null, paidSessionsThisPeriod: 0, freeTextToday: 0, freeTextDailyCap: 5 };

describe("canStartSession", () => {
  it("allows free text within the daily cap", () => {
    expect(canStartSession({ ...base, mode: "text", freeTextToday: 2 })).toEqual({ allowed: true, reason: "ok", consume: "free_text" });
  });
  it("blocks free text over the daily cap", () => {
    expect(canStartSession({ ...base, mode: "text", freeTextToday: 5 }).allowed).toBe(false);
  });
  it("gives a new user one free voice trial", () => {
    expect(canStartSession({ ...base, mode: "voice" })).toEqual({ allowed: true, reason: "ok", consume: "free_trial" });
  });
  it("blocks voice after trial used with no subscription", () => {
    const r = canStartSession({ ...base, mode: "voice", freeTrialUsed: true });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("no_subscription");
  });
  it("allows voice on an active subscription within quota", () => {
    const r = canStartSession({ ...base, mode: "voice", freeTrialUsed: true, subscription: { status: "active", quota: 10 }, paidSessionsThisPeriod: 3 });
    expect(r).toEqual({ allowed: true, reason: "ok", consume: "subscription" });
  });
  it("blocks voice when subscription quota is exhausted", () => {
    const r = canStartSession({ ...base, mode: "voice", freeTrialUsed: true, subscription: { status: "active", quota: 10 }, paidSessionsThisPeriod: 10 });
    expect(r.reason).toBe("quota_exceeded");
  });
  it("ignores a non-active subscription", () => {
    const r = canStartSession({ ...base, mode: "voice", freeTrialUsed: true, subscription: { status: "past_due", quota: 10 }, paidSessionsThisPeriod: 0 });
    expect(r.allowed).toBe(false);
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `npx vitest run src/core/entitlement.test.ts` → Expected: FAIL ("canStartSession is not a function").

- [ ] **Step 3: Implement**

```ts
import type { SubscriptionStatus } from "../domain/billing";

export type SessionMode = "text" | "voice";

export interface EntitlementInput {
  mode: SessionMode;
  freeTrialUsed: boolean;
  subscription: { status: SubscriptionStatus; quota: number } | null;
  paidSessionsThisPeriod: number;
  freeTextToday: number;
  freeTextDailyCap: number;
}

export type Consume = "free_text" | "free_trial" | "subscription" | "none";
export interface EntitlementResult {
  allowed: boolean;
  reason: string;
  consume: Consume;
}

export function canStartSession(i: EntitlementInput): EntitlementResult {
  if (i.mode === "text") {
    return i.freeTextToday < i.freeTextDailyCap
      ? { allowed: true, reason: "ok", consume: "free_text" }
      : { allowed: false, reason: "text_daily_cap", consume: "none" };
  }
  // voice / avatar
  const sub = i.subscription;
  if (sub && sub.status === "active") {
    return i.paidSessionsThisPeriod < sub.quota
      ? { allowed: true, reason: "ok", consume: "subscription" }
      : { allowed: false, reason: "quota_exceeded", consume: "none" };
  }
  if (!i.freeTrialUsed) {
    return { allowed: true, reason: "ok", consume: "free_trial" };
  }
  return { allowed: false, reason: "no_subscription", consume: "none" };
}
```

- [ ] **Step 4: Run it — verify it passes**

Run: `npx vitest run src/core/entitlement.test.ts` → Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/entitlement.ts src/core/entitlement.test.ts && git commit -m "feat(billing): entitlement logic (pure, tested)"
```

---

## Task 5: Server auth helper (verify Supabase JWT)

**Files:**
- Create: `src/services/auth.ts`

- [ ] **Step 1: Install the SSR helper**

Run: `npm i @supabase/ssr`

- [ ] **Step 2: Implement `getUserId`**

```ts
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

/** Extract + verify the Supabase access token from the Authorization header → user id. */
export async function getUserId(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization");
  const token = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null;
  if (!token || !env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

/** 401 helper. */
export function unauthorized(): Response {
  return Response.json({ error: "Sign in required." }, { status: 401 });
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` → Expected: no errors.
```bash
git add src/services/auth.ts package.json package-lock.json && git commit -m "feat(auth): server-side Supabase JWT verification"
```

---

## Task 6: Billing repository (profiles / subscriptions / usage)

**Files:**
- Create: `src/services/billingRepo.ts`

- [ ] **Step 1: Implement (service role, used by gating + webhooks)**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "./supabase";
import type { Subscription, SubscriptionStatus } from "../domain/billing";

export function createBillingRepo(client: SupabaseClient = createServiceClient()) {
  return {
    async getProfile(userId: string): Promise<{ freeTrialUsed: boolean } | null> {
      const { data } = await client.from("profiles").select("free_trial_used").eq("id", userId).maybeSingle();
      return data ? { freeTrialUsed: data.free_trial_used as boolean } : null;
    },
    async markTrialUsed(userId: string): Promise<void> {
      await client.from("profiles").update({ free_trial_used: true }).eq("id", userId);
    },
    async getActiveSubscription(userId: string): Promise<Subscription | null> {
      const { data } = await client
        .from("subscriptions")
        .select("plan_id, status, current_period_start, current_period_end, plans(monthly_session_quota)")
        .eq("user_id", userId)
        .in("status", ["active", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return null;
      const quota = (data as { plans?: { monthly_session_quota?: number } }).plans?.monthly_session_quota ?? 0;
      return {
        userId,
        planId: data.plan_id as string,
        status: data.status as SubscriptionStatus,
        monthlyQuota: quota,
        currentPeriodStart: data.current_period_start as string | null,
        currentPeriodEnd: data.current_period_end as string | null,
      };
    },
    /** Count consumed sessions of a billing kind since a timestamp. */
    async countSessionsSince(userId: string, billedAs: string, sinceIso: string): Promise<number> {
      const { count } = await client
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("candidate_id", userId)
        .eq("billed_as", billedAs)
        .gte("created_at", sinceIso);
      return count ?? 0;
    },
    async upsertSubscriptionByProviderId(input: {
      providerSubscriptionId: string;
      status: SubscriptionStatus;
      currentPeriodEnd?: string;
    }): Promise<void> {
      await client
        .from("subscriptions")
        .update({ status: input.status, current_period_end: input.currentPeriodEnd ?? null })
        .eq("provider_subscription_id", input.providerSubscriptionId);
    },
  };
}
export type BillingRepo = ReturnType<typeof createBillingRepo>;
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → Expected: no errors.
```bash
git add src/services/billingRepo.ts && git commit -m "feat(billing): billing repository"
```

---

## Task 7: PaymentProvider port + Cashfree adapter

**Files:**
- Create: `src/services/payments/provider.ts`
- Create: `src/services/payments/cashfree.ts`
- Test: `src/services/payments/cashfree.test.ts`

> **Verify against current Cashfree Subscriptions docs at this step** (endpoint paths, field names, and the webhook signature scheme can change). The code below is the intended shape; confirm and adjust field names in the sandbox.

- [ ] **Step 1: Port**

```ts
// provider.ts
import type { BillingEvent } from "../../domain/billing";

export interface PaymentProvider {
  createSubscriptionCheckout(input: { userId: string; email: string; planId: string; providerPlanId: string }): Promise<{ url: string }>;
  verifyAndParseWebhook(rawBody: string, signature: string, timestamp: string): BillingEvent;
}
```

- [ ] **Step 2: Write the webhook-verify failing test**

```ts
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { createCashfreeProvider } from "./cashfree";

describe("cashfree webhook verify", () => {
  it("accepts a correctly signed webhook and maps the event", () => {
    const secret = "whsec_test";
    const ts = "1700000000";
    const body = JSON.stringify({ type: "SUBSCRIPTION_STATUS_CHANGED", data: { subscription: { subscription_id: "sub_1", subscription_status: "ACTIVE", current_cycle_end: "2026-07-01" } } });
    const sig = createHmac("sha256", secret).update(ts + body).digest("base64");
    const p = createCashfreeProvider({ appId: "a", secretKey: "s", webhookSecret: secret, env: "sandbox" });
    const ev = p.verifyAndParseWebhook(body, sig, ts);
    expect(ev.type).toBe("subscription_active");
    expect(ev.providerSubscriptionId).toBe("sub_1");
  });
  it("rejects a bad signature", () => {
    const p = createCashfreeProvider({ appId: "a", secretKey: "s", webhookSecret: "whsec_test", env: "sandbox" });
    expect(() => p.verifyAndParseWebhook("{}", "wrong", "1700000000")).toThrow();
  });
});
```

- [ ] **Step 3: Run it — verify it fails**

Run: `npx vitest run src/services/payments/cashfree.test.ts` → Expected: FAIL (module not found).

- [ ] **Step 4: Implement the adapter**

```ts
// cashfree.ts
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProvider } from "./provider";
import type { BillingEvent } from "../../domain/billing";

interface Cfg { appId: string; secretKey: string; webhookSecret: string; env: "sandbox" | "production"; fetchImpl?: typeof fetch }

const BASE = { sandbox: "https://sandbox.cashfree.com/pg", production: "https://api.cashfree.com/pg" };

function mapStatus(s: string): BillingEvent["type"] {
  switch (s.toUpperCase()) {
    case "ACTIVE": return "subscription_active";
    case "BANK_APPROVAL_PENDING": case "INITIALIZED": return "ignored";
    case "CANCELLED": return "subscription_cancelled";
    case "COMPLETED": case "EXPIRED": return "subscription_expired";
    default: return "ignored";
  }
}

export function createCashfreeProvider(cfg: Cfg): PaymentProvider {
  const doFetch = cfg.fetchImpl ?? fetch;
  return {
    async createSubscriptionCheckout({ userId, email, providerPlanId }) {
      const res = await doFetch(`${BASE[cfg.env]}/subscriptions`, {
        method: "POST",
        headers: {
          "x-client-id": cfg.appId,
          "x-client-secret": cfg.secretKey,
          "x-api-version": "2023-08-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscription_id: `sub_${userId}_${Date.now()}`,
          plan_details: { plan_id: providerPlanId },
          customer_details: { customer_email: email, customer_id: userId },
          subscription_meta: { return_url: `${process.env.APP_URL ?? ""}/account` },
        }),
      });
      if (!res.ok) throw new Error(`Cashfree create subscription failed (${res.status}): ${await res.text().catch(() => "")}`);
      const data = (await res.json()) as { subscription_session_id?: string; authorization_details?: { authorization_link?: string } };
      const url = data.authorization_details?.authorization_link;
      if (!url) throw new Error("Cashfree did not return an authorization link");
      return { url };
    },
    verifyAndParseWebhook(rawBody, signature, timestamp) {
      const expected = createHmac("sha256", cfg.webhookSecret).update(timestamp + rawBody).digest("base64");
      const a = Buffer.from(expected);
      const b = Buffer.from(signature);
      if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Invalid webhook signature");
      const parsed = JSON.parse(rawBody) as { type?: string; data?: { subscription?: { subscription_id?: string; subscription_status?: string; current_cycle_end?: string } } };
      const sub = parsed.data?.subscription;
      return {
        type: mapStatus(sub?.subscription_status ?? ""),
        providerSubscriptionId: sub?.subscription_id ?? null,
        eventId: `${sub?.subscription_id}:${sub?.subscription_status}:${timestamp}`,
        currentPeriodEnd: sub?.current_cycle_end,
      };
    },
  };
}
```

- [ ] **Step 5: Run it — verify it passes**

Run: `npx vitest run src/services/payments/cashfree.test.ts` → Expected: PASS (2 tests). If the signature scheme differs in Cashfree's docs, adjust `verifyAndParseWebhook` and the test's `sig` together.

- [ ] **Step 6: Commit**

```bash
git add src/services/payments && git commit -m "feat(billing): PaymentProvider port + Cashfree adapter (webhook verify tested)"
```

---

## Task 8: Checkout route

**Files:**
- Create: `src/app/api/billing/checkout/route.ts`

- [ ] **Step 1: Implement**

```ts
import { z } from "zod";
import { getUserId, unauthorized } from "@/services/auth";
import { createServiceClient } from "@/services/supabase";
import { createCashfreeProvider } from "@/services/payments/cashfree";
import { env, hasCashfree } from "@/services/env";
import { ServiceUnavailableError } from "@/services/runtime";
import { errorResponse } from "@/services/http";
import { enforceRateLimit } from "@/services/rateLimit";

export const maxDuration = 30;
const Body = z.object({ planId: z.enum(["starter", "pro"]) });

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "checkout", 10);
  if (limited) return limited;
  try {
    if (!hasCashfree) throw new ServiceUnavailableError("Payments not configured.");
    const userId = await getUserId(request);
    if (!userId) return unauthorized();
    const { planId } = Body.parse(await request.json());

    const db = createServiceClient();
    const { data: plan } = await db.from("plans").select("provider_plan_id").eq("id", planId).maybeSingle();
    const { data: user } = await db.auth.admin.getUserById(userId);
    if (!plan?.provider_plan_id) throw new Error("Plan is missing a Cashfree plan id.");

    const provider = createCashfreeProvider({
      appId: env.CASHFREE_APP_ID!, secretKey: env.CASHFREE_SECRET_KEY!,
      webhookSecret: env.CASHFREE_WEBHOOK_SECRET ?? "", env: env.CASHFREE_ENV,
    });
    const { url } = await provider.createSubscriptionCheckout({
      userId, email: user.user?.email ?? "", planId, providerPlanId: plan.provider_plan_id,
    });
    return Response.json({ url });
  } catch (err) {
    return errorResponse(err);
  }
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → Expected: no errors.
```bash
git add src/app/api/billing/checkout/route.ts && git commit -m "feat(billing): subscription checkout route"
```

> **Manual setup before this works:** in the Cashfree dashboard create two subscription Plans matching `starter`/`pro`, then store their plan ids: `update plans set provider_plan_id='<cf_id>' where id='pro';` (and starter).

---

## Task 9: Webhook route (idempotent, signed)

**Files:**
- Create: `src/app/api/billing/webhook/route.ts`

- [ ] **Step 1: Implement**

```ts
import { createCashfreeProvider } from "@/services/payments/cashfree";
import { createBillingRepo } from "@/services/billingRepo";
import { env, hasCashfree } from "@/services/env";

export const maxDuration = 30;

export async function POST(request: Request) {
  if (!hasCashfree) return Response.json({ error: "not configured" }, { status: 503 });
  const raw = await request.text();
  const signature = request.headers.get("x-webhook-signature") ?? "";
  const timestamp = request.headers.get("x-webhook-timestamp") ?? "";
  const provider = createCashfreeProvider({
    appId: env.CASHFREE_APP_ID!, secretKey: env.CASHFREE_SECRET_KEY!,
    webhookSecret: env.CASHFREE_WEBHOOK_SECRET ?? "", env: env.CASHFREE_ENV,
  });

  let event;
  try {
    event = provider.verifyAndParseWebhook(raw, signature, timestamp);
  } catch {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }
  if (event.type === "ignored" || !event.providerSubscriptionId) return Response.json({ ok: true });

  const status =
    event.type === "subscription_active" ? "active" :
    event.type === "subscription_cancelled" ? "cancelled" : "expired";

  await createBillingRepo().upsertSubscriptionByProviderId({
    providerSubscriptionId: event.providerSubscriptionId,
    status,
    currentPeriodEnd: event.currentPeriodEnd,
  });
  return Response.json({ ok: true });
}
```

> Idempotency: `upsertSubscriptionByProviderId` is a state set (not an increment), so reprocessing the same event is safe. (When you add per-charge credits later, dedupe on `event.eventId`.)

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → Expected: no errors.
```bash
git add src/app/api/billing/webhook/route.ts && git commit -m "feat(billing): Cashfree webhook (signed, idempotent)"
```

> **Manual setup:** point the Cashfree dashboard webhook at `https://<your-domain>/api/billing/webhook`.

---

## Task 10: Session-start gate + auth-gate the interview routes

**Files:**
- Create: `src/app/api/session/start/route.ts`
- Modify: `src/app/api/interview/prepare/route.ts`, `turn/route.ts`, `score/route.ts`, `simli/session/route.ts`

- [ ] **Step 1: Implement the gate**

```ts
// src/app/api/session/start/route.ts
import { z } from "zod";
import { getUserId, unauthorized } from "@/services/auth";
import { createBillingRepo } from "@/services/billingRepo";
import { canStartSession } from "@/core/entitlement";
import { env, hasSupabaseService } from "@/services/env";
import { errorResponse } from "@/services/http";
import { enforceRateLimit } from "@/services/rateLimit";

export const maxDuration = 30;
const Body = z.object({ mode: z.enum(["text", "voice"]) });

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "session-start", 30);
  if (limited) return limited;
  try {
    const userId = await getUserId(request);
    if (!userId) return unauthorized();
    if (!hasSupabaseService) return Response.json({ error: "not configured" }, { status: 503 });
    const { mode } = Body.parse(await request.json());

    const repo = createBillingRepo();
    const profile = (await repo.getProfile(userId)) ?? { freeTrialUsed: false };
    const sub = await repo.getActiveSubscription(userId);
    const periodStart = sub?.currentPeriodStart ?? new Date(Date.now() - 30 * 864e5).toISOString();
    const todayStart = new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString();

    const result = canStartSession({
      mode,
      freeTrialUsed: profile.freeTrialUsed,
      subscription: sub && sub.status === "active" ? { status: "active", quota: sub.monthlyQuota } : null,
      paidSessionsThisPeriod: await repo.countSessionsSince(userId, "subscription", periodStart),
      freeTextToday: await repo.countSessionsSince(userId, "free_text", todayStart),
      freeTextDailyCap: env.FREE_TEXT_DAILY_CAP,
    });
    if (!result.allowed) return Response.json({ allowed: false, reason: result.reason }, { status: 402 });

    if (result.consume === "free_trial") await repo.markTrialUsed(userId);
    return Response.json({ allowed: true, billedAs: result.consume });
  } catch (err) {
    return errorResponse(err);
  }
}
```

> Note: a session row is written by the existing `score` flow; set its `billed_as = result.consume` and `mode` there so `countSessionsSince` reflects real usage. (Add `billedAs`/`mode` params through the score route's `createSession`/`completeSession`.)

- [ ] **Step 2: Auth-gate the expensive interview routes**

In each of `prepare`, `turn`, `score`, `simli/session` route handlers, add at the top of `POST` (after the rate-limit line):

```ts
const userId = await getUserId(request);
if (!userId) return unauthorized();
```
(Import `getUserId, unauthorized` from `@/services/auth`.)

- [ ] **Step 3: Update the route integration test for auth**

In `src/app/api/interview/routes.integration.test.ts`, set a fake bearer + stub `getUserId` is non-trivial; instead assert these routes now return **401 without an Authorization header**:

```ts
it("prepare requires auth", async () => {
  const res = await prepare(post({ jd: "x".repeat(40), guidelines }));
  expect(res.status).toBe(401);
});
```
(Remove/adjust the prior no-auth 200 assertions — they now need a valid token, which is covered by the sandbox E2E in Task 15.)

- [ ] **Step 4: Run tests + commit**

Run: `npm test` → Expected: PASS (entitlement + adjusted route tests).
```bash
git add src/app/api && git commit -m "feat(billing): session-start entitlement gate + auth-gate interview routes"
```

---

## Task 11: Durable rate limiting (Upstash, with in-memory fallback)

**Files:**
- Create: `src/services/redisRateLimit.ts`
- Modify: `src/services/rateLimit.ts`

- [ ] **Step 1: Install + implement the Upstash limiter**

Run: `npm i @upstash/redis @upstash/ratelimit`

```ts
// redisRateLimit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env, hasUpstash } from "./env";

const limiters = new Map<string, Ratelimit>();
function limiter(name: string, limit: number, windowSec: number): Ratelimit | null {
  if (!hasUpstash) return null;
  const key = `${name}:${limit}:${windowSec}`;
  if (!limiters.has(key)) {
    limiters.set(key, new Ratelimit({
      redis: new Redis({ url: env.UPSTASH_REDIS_REST_URL!, token: env.UPSTASH_REDIS_REST_TOKEN! }),
      limiter: Ratelimit.fixedWindow(limit, `${windowSec} s`),
      prefix: `rl:${name}`,
    }));
  }
  return limiters.get(key)!;
}

export async function durableCheck(name: string, id: string, limit: number, windowSec = 60): Promise<boolean | null> {
  const l = limiter(name, limit, windowSec);
  if (!l) return null; // not configured → caller falls back to in-memory
  const { success } = await l.limit(id);
  return success;
}
```

- [ ] **Step 2: Make `enforceRateLimit` prefer the durable limiter**

Convert `enforceRateLimit` in `rateLimit.ts` to async and try `durableCheck` first, falling back to the existing in-memory `checkRateLimit` when Upstash isn't configured. Update every `enforceRateLimit(...)` call site to `await`.

```ts
export async function enforceRateLimit(request: Request, name: string, limit: number, windowMs = 60_000): Promise<Response | null> {
  const id = clientIp(request);
  const durable = await durableCheck(name, id, limit, Math.round(windowMs / 1000));
  const ok = durable === null ? checkRateLimit(`${name}:${id}`, limit, windowMs).ok : durable;
  return ok ? null : Response.json({ error: "Too many requests — please slow down." }, { status: 429 });
}
```

- [ ] **Step 3: Update call sites + run tests**

Each route: `const limited = await enforceRateLimit(...)`. The `checkRateLimit` unit test still passes unchanged.
Run: `npm test` and `npx tsc --noEmit` → Expected: PASS / no errors.

- [ ] **Step 4: Commit**

```bash
git add src/services package.json package-lock.json && git commit -m "feat(security): durable Upstash rate limiting with in-memory fallback"
```

---

## Task 12: Browser auth (Supabase Google OAuth) + AuthGate

**Files:**
- Create: `src/lib/supabaseBrowser.ts`, `src/components/AuthGate.tsx`

- [ ] **Step 1: Browser client**

```ts
"use client";
import { createBrowserClient } from "@supabase/ssr";
let client: ReturnType<typeof createBrowserClient> | null = null;
export function supabaseBrowser() {
  if (!client) {
    client = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  }
  return client;
}
```

- [ ] **Step 2: AuthGate (renders children only when signed in; else a Google sign-in)**

```tsx
"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { Button, Card } from "@/components/ui";

export function useAccessToken() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const sb = supabaseBrowser();
    sb.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setToken(s?.access_token ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  return token;
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const token = useAccessToken();
  if (token) return <>{children}</>;
  return (
    <Card className="mx-auto max-w-sm p-8 text-center">
      <h2 className="mb-2 text-lg font-semibold">Sign in to start</h2>
      <p className="mb-4 text-sm text-slate-500">Your first voice interview is free.</p>
      <Button onClick={() => supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } })}>
        Continue with Google
      </Button>
    </Card>
  );
}
```

- [ ] **Step 3: Send the token on API calls**

In `src/lib/api.ts`, change `postJson` to attach the bearer token:
```ts
import { supabaseBrowser } from "@/lib/supabaseBrowser";
async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabaseBrowser().auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}
```
and merge `...(await authHeader())` into the `headers` of `postJson`.

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit` → Expected: no errors.
```bash
git add src/lib src/components/AuthGate.tsx && git commit -m "feat(auth): browser Google OAuth + bearer-token API calls"
```

---

## Task 13: Paywall + account page + wire the gate into the flow

**Files:**
- Create: `src/components/Paywall.tsx`, `src/app/account/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Paywall (shown when `/api/session/start` returns 402)**

```tsx
"use client";
import { Button, Card } from "@/components/ui";
import { apiCheckout } from "@/lib/api";

export default function Paywall({ reason }: { reason: string }) {
  async function buy(planId: "starter" | "pro") {
    const { url } = await apiCheckout(planId);
    window.location.href = url;
  }
  return (
    <Card className="mx-auto max-w-md p-8 text-center">
      <h2 className="text-lg font-semibold">Upgrade to keep practicing</h2>
      <p className="mb-4 text-sm text-slate-500">{reason === "quota_exceeded" ? "You've used this month's sessions." : "Your free trial is used up."}</p>
      <div className="flex justify-center gap-3">
        <Button variant="secondary" onClick={() => buy("starter")}>Starter ₹999</Button>
        <Button onClick={() => buy("pro")}>Pro ₹1,999</Button>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Add `apiCheckout` + `apiSessionStart` to `src/lib/api.ts`**

```ts
export const apiCheckout = (planId: "starter" | "pro") => postJson<{ url: string }>("/api/billing/checkout", { planId });
export const apiSessionStart = (mode: "text" | "voice") =>
  postJson<{ allowed: boolean; reason?: string; billedAs?: string }>("/api/session/start", { mode });
```
(Have `postJson` not throw on 402 — return the parsed body so the UI can show the paywall. Adjust `postJson` to treat 402 as a normal payload.)

- [ ] **Step 3: Wire into the orchestrator**

In `src/app/page.tsx`: wrap the app in `AuthGate`. In `onPrepared` (or just before starting), call `apiSessionStart(mode)`; if `!allowed`, render `<Paywall reason={...} />` instead of the interview.

- [ ] **Step 4: Account page (subscription status)**

```tsx
"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function Account() {
  const [info, setInfo] = useState<string>("Loading…");
  useEffect(() => {
    supabaseBrowser().from("subscriptions").select("plan_id,status,current_period_end").order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setInfo(data ? `${data.plan_id} · ${data.status} · renews ${data.current_period_end ?? "-"}` : "No active subscription"));
  }, []);
  return <main className="mx-auto max-w-md p-10"><h1 className="mb-3 text-xl font-semibold">Account</h1><p className="text-sm text-slate-600">{info}</p></main>;
}
```

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npx tsc --noEmit && npm run lint` → Expected: clean.
```bash
git add src/app src/components/Paywall.tsx src/lib/api.ts && git commit -m "feat(billing): paywall + account page + session-start gating in the flow"
```

---

## Task 14: Free-text daily-cap guard (verify)

**Files:**
- (No new code — covered by Task 10's entitlement for `mode: "text"` + `FREE_TEXT_DAILY_CAP`.)

- [ ] **Step 1: Confirm text mode routes through `/api/session/start`**

Ensure the text interview calls `apiSessionStart("text")` before `prepare`/`turn`, and that completed text sessions are written with `billed_as = "free_text"` and `mode = "text"` so `countSessionsSince` enforces the cap. Add a session-row write for text mode if one doesn't already exist (text mode currently scores in memory mode without a session row — add a lightweight `sessions` insert on text completion when Supabase is configured).

- [ ] **Step 2: Commit any wiring**

```bash
git add -A && git commit -m "feat(billing): enforce free-text daily cap via session metering"
```

---

## Task 15: End-to-end verification (Cashfree sandbox)

- [ ] **Step 1: Full suite green**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build` → Expected: all pass.

- [ ] **Step 2: Auth E2E (manual, headed)**

Sign in with Google → confirm a `profiles` row is created → start a **voice** interview → confirm it's allowed (free trial) and `profiles.free_trial_used` flips true → start another voice interview → confirm **402** + paywall.

- [ ] **Step 3: Cashfree sandbox E2E (manual)**

From the paywall, buy **Pro** → complete the sandbox mandate authorization → confirm the webhook flips the subscription to `active` (check `subscriptions` table) → start a voice interview → allowed; repeat to the quota → 402 `quota_exceeded`.

- [ ] **Step 4: Margin sanity**

Run a session, confirm `sessions.est_cost_usd` is recorded, and spot-check `estimateSessionCost` vs the plan price stays ≥25% margin.

- [ ] **Step 5: Commit docs + push**

```bash
git add -A && git commit -m "docs: payments+auth verified in sandbox" && git push
```

---

## Notes / risks

- **Cashfree API specifics** (endpoint version, field names, webhook signature) — verify in Task 7 against current docs; the test + impl change together.
- **Auth on serverless** — `getUser(token)` calls Supabase each request; acceptable, or cache per-request.
- **Existing text/memory mode** — when Supabase isn't configured the app still runs free/local (gating no-ops). Gating is enforced only when `hasSupabaseService`.
- **Trial abuse** — tied to Google-verified email; accept multi-account friction (monitor).
