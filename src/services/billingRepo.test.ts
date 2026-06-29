import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createBillingRepo } from "./billingRepo";

/**
 * Unit tests for the billing repository against a fake Supabase query builder.
 * The real atomicity (claimFreeTrial) is a Postgres guarantee covered by the
 * live RLS/integration tests; here we pin the repo-level contract: which table is
 * hit, with which filters, and how the driver's result shape is interpreted.
 */

type Result = { data?: unknown; error?: { message: string } | null; count?: number };

/** Minimal chainable + thenable stand-in for the supabase-js query builder. */
function fakeClient(resultFor: (table: string, calls: [string, unknown[]][]) => Result): SupabaseClient {
  const make = (table: string) => {
    const calls: [string, unknown[]][] = [];
    const builder: Record<string, unknown> = {};
    const chain = (m: string) => (...args: unknown[]) => {
      calls.push([m, args]);
      return builder;
    };
    for (const m of ["select", "insert", "update", "eq", "in", "gte", "order", "limit"]) {
      builder[m] = chain(m);
    }
    builder.maybeSingle = () => Promise.resolve(resultFor(table, calls));
    builder.single = () => Promise.resolve(resultFor(table, calls));
    builder.then = (res: (v: Result) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(resultFor(table, calls)).then(res, rej);
    return builder;
  };
  return { from: (t: string) => make(t) } as unknown as SupabaseClient;
}

describe("billingRepo.getProfile", () => {
  it("returns the trial flag when the profile exists", async () => {
    const repo = createBillingRepo(fakeClient(() => ({ data: { free_trial_used: true } })));
    expect(await repo.getProfile("u1")).toEqual({ freeTrialUsed: true });
  });
  it("returns null when there is no profile row", async () => {
    const repo = createBillingRepo(fakeClient(() => ({ data: null })));
    expect(await repo.getProfile("u1")).toBeNull();
  });
});

describe("billingRepo.claimFreeTrial (atomic double-spend guard)", () => {
  it("returns true only when exactly one row flipped false→true", async () => {
    const repo = createBillingRepo(fakeClient(() => ({ data: [{ id: "u1" }], error: null })));
    expect(await repo.claimFreeTrial("u1")).toBe(true);
  });
  it("returns false when the trial was already used (zero rows updated)", async () => {
    const repo = createBillingRepo(fakeClient(() => ({ data: [], error: null })));
    expect(await repo.claimFreeTrial("u1")).toBe(false);
  });
  it("filters the update on free_trial_used=false so a used trial can't be re-claimed", async () => {
    let calls: [string, unknown[]][] = [];
    const repo = createBillingRepo(
      fakeClient((_t, c) => {
        calls = c;
        return { data: [{ id: "u1" }], error: null };
      }),
    );
    await repo.claimFreeTrial("u1");
    const eqs = calls.filter((c) => c[0] === "eq").map((c) => c[1]);
    expect(eqs).toContainEqual(["id", "u1"]);
    expect(eqs).toContainEqual(["free_trial_used", false]);
  });
  it("throws when the driver reports an error", async () => {
    const repo = createBillingRepo(fakeClient(() => ({ data: null, error: { message: "boom" } })));
    await expect(repo.claimFreeTrial("u1")).rejects.toThrow(/claimFreeTrial failed: boom/);
  });
});

describe("billingRepo.getActiveSubscription", () => {
  it("maps a row + nested plan quota into the domain shape", async () => {
    const repo = createBillingRepo(
      fakeClient(() => ({
        data: {
          plan_id: "pro",
          status: "active",
          current_period_start: "2026-06-01",
          current_period_end: "2026-07-01",
          plans: { monthly_session_quota: 10 },
        },
      })),
    );
    expect(await repo.getActiveSubscription("u1")).toEqual({
      userId: "u1",
      planId: "pro",
      status: "active",
      monthlyQuota: 10,
      currentPeriodStart: "2026-06-01",
      currentPeriodEnd: "2026-07-01",
    });
  });
  it("defaults quota to 0 when the plan join is missing", async () => {
    const repo = createBillingRepo(
      fakeClient(() => ({
        data: { plan_id: "pro", status: "active", current_period_start: null, current_period_end: null },
      })),
    );
    expect((await repo.getActiveSubscription("u1"))?.monthlyQuota).toBe(0);
  });
  it("returns null when there is no active/past_due subscription", async () => {
    const repo = createBillingRepo(fakeClient(() => ({ data: null })));
    expect(await repo.getActiveSubscription("u1")).toBeNull();
  });
  it("only considers active or past_due statuses", async () => {
    let calls: [string, unknown[]][] = [];
    const repo = createBillingRepo(
      fakeClient((_t, c) => {
        calls = c;
        return { data: null };
      }),
    );
    await repo.getActiveSubscription("u1");
    const inCall = calls.find((c) => c[0] === "in");
    expect(inCall?.[1]).toEqual(["status", ["active", "past_due"]]);
  });
});

describe("billingRepo.countSessionsSince", () => {
  it("returns the driver count", async () => {
    const repo = createBillingRepo(fakeClient(() => ({ count: 4 })));
    expect(await repo.countSessionsSince("u1", "subscription", "2026-06-01")).toBe(4);
  });
  it("treats a null count as zero", async () => {
    const repo = createBillingRepo(fakeClient(() => ({ count: undefined })));
    expect(await repo.countSessionsSince("u1", "free_text", "2026-06-01")).toBe(0);
  });
});

describe("billingRepo.recordUsage", () => {
  it("inserts a usage_events row with the user, mode, and billing kind", async () => {
    let table = "";
    let inserted: Record<string, unknown> | undefined;
    const repo = createBillingRepo(
      fakeClient((t, c) => {
        table = t;
        const ins = c.find((x) => x[0] === "insert");
        if (ins) inserted = ins[1][0] as Record<string, unknown>;
        return {};
      }),
    );
    await repo.recordUsage("u1", "voice", "subscription");
    expect(table).toBe("usage_events");
    expect(inserted).toEqual({ user_id: "u1", mode: "voice", billed_as: "subscription" });
  });
});

describe("billingRepo.upsertSubscriptionByProviderId", () => {
  it("updates status + period end filtered by provider_subscription_id", async () => {
    let updateArg: Record<string, unknown> | undefined;
    let eqArg: unknown[] | undefined;
    const repo = createBillingRepo(
      fakeClient((_t, c) => {
        const u = c.find((x) => x[0] === "update");
        if (u) updateArg = u[1][0] as Record<string, unknown>;
        const e = c.find((x) => x[0] === "eq");
        if (e) eqArg = e[1];
        return {};
      }),
    );
    await repo.upsertSubscriptionByProviderId({
      providerSubscriptionId: "sub_abc",
      status: "active",
      currentPeriodEnd: "2026-07-01",
    });
    expect(updateArg).toEqual({ status: "active", current_period_end: "2026-07-01" });
    expect(eqArg).toEqual(["provider_subscription_id", "sub_abc"]);
  });
});

describe("billingRepo.createPendingSubscription (so the webhook has a row to activate)", () => {
  it("inserts a non-active subscription row keyed by the provider subscription id", async () => {
    let table = "";
    let inserted: Record<string, unknown> | undefined;
    const repo = createBillingRepo(
      fakeClient((t, c) => {
        table = t;
        const ins = c.find((x) => x[0] === "insert");
        if (ins) inserted = ins[1][0] as Record<string, unknown>;
        return { error: null };
      }),
    );
    await repo.createPendingSubscription({ userId: "u1", planId: "pro", providerSubscriptionId: "sub_u1_1" });
    expect(table).toBe("subscriptions");
    expect(inserted).toMatchObject({ user_id: "u1", plan_id: "pro", provider_subscription_id: "sub_u1_1" });
    // Must NOT be entitled until the webhook confirms payment.
    expect(inserted?.status).not.toBe("active");
  });
  it("throws when the insert fails", async () => {
    const repo = createBillingRepo(fakeClient(() => ({ error: { message: "dup key" } })));
    await expect(
      repo.createPendingSubscription({ userId: "u1", planId: "pro", providerSubscriptionId: "sub_u1_1" }),
    ).rejects.toThrow(/dup key/);
  });
});
