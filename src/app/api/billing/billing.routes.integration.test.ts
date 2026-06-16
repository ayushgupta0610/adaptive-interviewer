import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

/**
 * Route-handler integration tests for the billing + session-gating endpoints.
 * The service seams (auth, billing repo, payment provider, supabase, env, rate
 * limiter) are mocked so the handlers run their full validation → business-logic →
 * response path without live keys or a database.
 */

const h = vi.hoisted(() => {
  const repo = {
    getProfile: vi.fn(),
    claimFreeTrial: vi.fn(),
    getActiveSubscription: vi.fn(),
    countSessionsSince: vi.fn(),
    recordUsage: vi.fn(),
    createPendingSubscription: vi.fn(),
    upsertSubscriptionByProviderId: vi.fn(),
  };
  const provider = {
    createSubscriptionCheckout: vi.fn(),
    verifyAndParseWebhook: vi.fn(),
  };
  return {
    repo,
    provider,
    getUserId: vi.fn(),
    flags: { hasCashfree: true, hasCashfreeWebhook: true, hasSupabaseService: true },
    env: {
      CASHFREE_APP_ID: "app",
      CASHFREE_SECRET_KEY: "sk",
      CASHFREE_WEBHOOK_SECRET: "wh",
      CASHFREE_ENV: "sandbox",
      FREE_TEXT_DAILY_CAP: 5,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "srk",
    },
    plan: { provider_plan_id: "cf_plan_123" } as { provider_plan_id: string | null } | null,
    userEmail: "buyer@example.com" as string | undefined,
  };
});

vi.mock("@/services/env", () => ({
  env: h.env,
  get hasCashfree() {
    return h.flags.hasCashfree;
  },
  get hasCashfreeWebhook() {
    return h.flags.hasCashfreeWebhook;
  },
  get hasSupabaseService() {
    return h.flags.hasSupabaseService;
  },
}));
vi.mock("@/services/auth", () => ({
  getUserId: h.getUserId,
  unauthorized: () => Response.json({ error: "Sign in required." }, { status: 401 }),
}));
vi.mock("@/services/billingRepo", () => ({ createBillingRepo: () => h.repo }));
vi.mock("@/services/payments/cashfree", () => ({ createCashfreeProvider: () => h.provider }));
vi.mock("@/services/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/services/supabase", () => ({
  createServiceClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.plan }) }) }) }),
    auth: { admin: { getUserById: async () => ({ data: { user: { email: h.userEmail } } }) } },
  }),
}));

type Handler = (req: Request) => Promise<Response>;
let checkout: Handler;
let webhook: Handler;
let sessionStart: Handler;

function post(url: string, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeAll(async () => {
  checkout = (await import("./checkout/route")).POST as Handler;
  webhook = (await import("./webhook/route")).POST as Handler;
  sessionStart = (await import("../session/start/route")).POST as Handler;
});

beforeEach(() => {
  vi.clearAllMocks();
  h.flags.hasCashfree = true;
  h.flags.hasCashfreeWebhook = true;
  h.flags.hasSupabaseService = true;
  h.plan = { provider_plan_id: "cf_plan_123" };
  h.userEmail = "buyer@example.com";
  h.getUserId.mockResolvedValue("user_1");
  h.provider.createSubscriptionCheckout.mockResolvedValue({ url: "https://pay/redirect" });
  h.repo.getProfile.mockResolvedValue({ freeTrialUsed: false });
  h.repo.getActiveSubscription.mockResolvedValue(null);
  h.repo.countSessionsSince.mockResolvedValue(0);
  h.repo.claimFreeTrial.mockResolvedValue(true);
  h.repo.recordUsage.mockResolvedValue(undefined);
  h.repo.createPendingSubscription.mockResolvedValue(undefined);
});

describe("POST /api/billing/checkout", () => {
  const url = "http://test/api/billing/checkout";

  it("401s when the caller is not signed in", async () => {
    h.getUserId.mockResolvedValue(null);
    expect((await checkout(post(url, { planId: "pro" }))).status).toBe(401);
  });

  it("400s on an invalid plan id", async () => {
    expect((await checkout(post(url, { planId: "enterprise" }))).status).toBe(400);
  });

  it("503s when Cashfree is not configured", async () => {
    h.flags.hasCashfree = false;
    expect((await checkout(post(url, { planId: "pro" }))).status).toBe(503);
  });

  it("400s when the account has no email", async () => {
    h.userEmail = undefined;
    expect((await checkout(post(url, { planId: "pro" }))).status).toBe(400);
  });

  it("persists a pending subscription row keyed by the id sent to Cashfree [activation regression]", async () => {
    const res = await checkout(post(url, { planId: "pro" }));
    expect(res.status).toBe(200);
    expect(h.repo.createPendingSubscription).toHaveBeenCalledTimes(1);
    const persisted = h.repo.createPendingSubscription.mock.calls[0][0];
    expect(persisted).toMatchObject({ userId: "user_1", planId: "pro" });
    expect(persisted.providerSubscriptionId).toBeTruthy();
    // The persisted id MUST match the id handed to Cashfree, or the webhook can never find the row.
    const sentToProvider = h.provider.createSubscriptionCheckout.mock.calls[0][0];
    expect(sentToProvider.subscriptionId).toBe(persisted.providerSubscriptionId);
  });

  it("returns the provider checkout url", async () => {
    const res = await checkout(post(url, { planId: "pro" }));
    expect((await res.json()).url).toBe("https://pay/redirect");
  });
});

describe("POST /api/billing/webhook", () => {
  const url = "http://test/api/billing/webhook";
  const fresh = (body = "{}") =>
    new Request(url, {
      method: "POST",
      headers: {
        "x-webhook-signature": "sig",
        "x-webhook-timestamp": String(Math.floor(Date.now() / 1000)),
      },
      body,
    });

  beforeEach(() => {
    h.provider.verifyAndParseWebhook.mockReturnValue({
      type: "subscription_active",
      providerSubscriptionId: "sub_user_1_1",
      eventId: "e1",
      currentPeriodEnd: "2026-07-01",
    });
  });

  it("503s when the webhook is not configured", async () => {
    h.flags.hasCashfreeWebhook = false;
    expect((await webhook(fresh())).status).toBe(503);
  });

  it("401s on a stale timestamp (replay window)", async () => {
    const stale = new Request(url, {
      method: "POST",
      headers: { "x-webhook-signature": "sig", "x-webhook-timestamp": String(Math.floor(Date.now() / 1000) - 600) },
      body: "{}",
    });
    expect((await webhook(stale)).status).toBe(401);
  });

  it("401s on a missing/zero timestamp", async () => {
    const noTs = new Request(url, {
      method: "POST",
      headers: { "x-webhook-signature": "sig", "x-webhook-timestamp": "0" },
      body: "{}",
    });
    expect((await webhook(noTs)).status).toBe(401);
  });

  it("401s when signature verification throws", async () => {
    h.provider.verifyAndParseWebhook.mockImplementation(() => {
      throw new Error("Invalid webhook signature");
    });
    expect((await webhook(fresh())).status).toBe(401);
  });

  it("ignores non-actionable events without touching the database", async () => {
    h.provider.verifyAndParseWebhook.mockReturnValue({ type: "ignored", providerSubscriptionId: null, eventId: "e" });
    const res = await webhook(fresh());
    expect(res.status).toBe(200);
    expect(h.repo.upsertSubscriptionByProviderId).not.toHaveBeenCalled();
  });

  it("activates the subscription on a subscription_active event", async () => {
    const res = await webhook(fresh());
    expect(res.status).toBe(200);
    expect(h.repo.upsertSubscriptionByProviderId).toHaveBeenCalledWith({
      providerSubscriptionId: "sub_user_1_1",
      status: "active",
      currentPeriodEnd: "2026-07-01",
    });
  });

  it("maps a cancelled event to status cancelled", async () => {
    h.provider.verifyAndParseWebhook.mockReturnValue({
      type: "subscription_cancelled",
      providerSubscriptionId: "sub_user_1_1",
      eventId: "e2",
    });
    await webhook(fresh());
    expect(h.repo.upsertSubscriptionByProviderId).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" }),
    );
  });
});

describe("POST /api/session/start", () => {
  const url = "http://test/api/session/start";
  const active = {
    userId: "user_1",
    planId: "pro",
    status: "active" as const,
    monthlyQuota: 10,
    currentPeriodStart: null,
    currentPeriodEnd: null,
  };

  it("401s when the caller is not signed in", async () => {
    h.getUserId.mockResolvedValue(null);
    expect((await sessionStart(post(url, { mode: "voice" }))).status).toBe(401);
  });

  it("503s when Supabase service is not configured", async () => {
    h.flags.hasSupabaseService = false;
    expect((await sessionStart(post(url, { mode: "voice" }))).status).toBe(503);
  });

  it("400s on an invalid mode", async () => {
    expect((await sessionStart(post(url, { mode: "video" }))).status).toBe(400);
  });

  it("grants the one free voice trial and atomically claims it", async () => {
    const res = await sessionStart(post(url, { mode: "voice" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ allowed: true, billedAs: "free_trial" });
    expect(h.repo.claimFreeTrial).toHaveBeenCalledWith("user_1");
    expect(h.repo.recordUsage).toHaveBeenCalledWith("user_1", "voice", "free_trial");
  });

  it("blocks the voice trial when the atomic claim loses the race (double-spend guard)", async () => {
    h.repo.claimFreeTrial.mockResolvedValue(false);
    const res = await sessionStart(post(url, { mode: "voice" }));
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ reason: "trial_used" });
    expect(h.repo.recordUsage).not.toHaveBeenCalled();
  });

  it("blocks voice with 402 when the trial is used and there is no subscription", async () => {
    h.repo.getProfile.mockResolvedValue({ freeTrialUsed: true });
    const res = await sessionStart(post(url, { mode: "voice" }));
    expect(res.status).toBe(402);
    expect((await res.json()).reason).toBe("no_subscription");
    expect(h.repo.claimFreeTrial).not.toHaveBeenCalled();
  });

  it("treats a past_due subscription as no entitlement", async () => {
    h.repo.getProfile.mockResolvedValue({ freeTrialUsed: true });
    h.repo.getActiveSubscription.mockResolvedValue({ ...active, status: "past_due" });
    const res = await sessionStart(post(url, { mode: "voice" }));
    expect(res.status).toBe(402);
    expect((await res.json()).reason).toBe("no_subscription");
  });

  it("allows voice on an active subscription within quota and bills it as subscription", async () => {
    h.repo.getProfile.mockResolvedValue({ freeTrialUsed: true });
    h.repo.getActiveSubscription.mockResolvedValue(active);
    h.repo.countSessionsSince.mockResolvedValue(3);
    const res = await sessionStart(post(url, { mode: "voice" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ allowed: true, billedAs: "subscription" });
    expect(h.repo.recordUsage).toHaveBeenCalledWith("user_1", "voice", "subscription");
  });

  it("blocks voice with 402 when the subscription quota is exhausted", async () => {
    h.repo.getProfile.mockResolvedValue({ freeTrialUsed: true });
    h.repo.getActiveSubscription.mockResolvedValue(active);
    h.repo.countSessionsSince.mockResolvedValue(10);
    const res = await sessionStart(post(url, { mode: "voice" }));
    expect(res.status).toBe(402);
    expect((await res.json()).reason).toBe("quota_exceeded");
  });

  it("allows free text within the daily cap and bills it as free_text", async () => {
    h.repo.countSessionsSince.mockResolvedValue(2);
    const res = await sessionStart(post(url, { mode: "text" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ allowed: true, billedAs: "free_text" });
  });

  it("blocks free text over the daily cap with 402", async () => {
    h.repo.countSessionsSince.mockResolvedValue(5);
    const res = await sessionStart(post(url, { mode: "text" }));
    expect(res.status).toBe(402);
    expect((await res.json()).reason).toBe("text_daily_cap");
  });
});
