import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { createCashfreeProvider } from "./cashfree";

const cfg = (over: Partial<Parameters<typeof createCashfreeProvider>[0]> = {}) => ({
  appId: "app",
  secretKey: "sk",
  webhookSecret: "whsec_test",
  env: "sandbox" as const,
  ...over,
});

/** Produce a body + a correct Cashfree-style signature (HMAC over timestamp+body). */
function signed(secret: string, ts: string, payload: unknown) {
  const body = JSON.stringify(payload);
  const sig = createHmac("sha256", secret).update(ts + body).digest("base64");
  return { body, sig };
}

const sub = (status: string) => ({
  type: "SUBSCRIPTION_STATUS_CHANGED",
  data: { subscription: { subscription_id: "sub_1", subscription_status: status, current_cycle_end: "2026-07-01" } },
});

describe("cashfree verifyAndParseWebhook — signature", () => {
  it("accepts a correctly signed webhook and maps ACTIVE → subscription_active", () => {
    const ts = "1700000000";
    const { body, sig } = signed("whsec_test", ts, sub("ACTIVE"));
    const ev = createCashfreeProvider(cfg()).verifyAndParseWebhook(body, sig, ts);
    expect(ev.type).toBe("subscription_active");
    expect(ev.providerSubscriptionId).toBe("sub_1");
    expect(ev.currentPeriodEnd).toBe("2026-07-01");
  });

  it("rejects a signature of the wrong length", () => {
    expect(() => createCashfreeProvider(cfg()).verifyAndParseWebhook("{}", "wrong", "1700000000")).toThrow(
      /signature/i,
    );
  });

  it("rejects an equal-length but incorrect signature", () => {
    const ts = "1700000000";
    const { body, sig } = signed("whsec_test", ts, sub("ACTIVE"));
    const tampered = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    expect(() => createCashfreeProvider(cfg()).verifyAndParseWebhook(body, tampered, ts)).toThrow(/signature/i);
  });

  it("throws when the webhook secret is not configured (no forged-webhook bypass)", () => {
    expect(() =>
      createCashfreeProvider(cfg({ webhookSecret: "" })).verifyAndParseWebhook("{}", "sig", "1700000000"),
    ).toThrow(/secret/i);
  });
});

describe("cashfree verifyAndParseWebhook — status mapping", () => {
  const map = (status: string) => {
    const ts = "1700000000";
    const { body, sig } = signed("whsec_test", ts, sub(status));
    return createCashfreeProvider(cfg()).verifyAndParseWebhook(body, sig, ts).type;
  };
  it("CANCELLED → subscription_cancelled", () => expect(map("CANCELLED")).toBe("subscription_cancelled"));
  it("COMPLETED → subscription_expired", () => expect(map("COMPLETED")).toBe("subscription_expired"));
  it("EXPIRED → subscription_expired", () => expect(map("EXPIRED")).toBe("subscription_expired"));
  it("BANK_APPROVAL_PENDING → ignored", () => expect(map("BANK_APPROVAL_PENDING")).toBe("ignored"));
  it("INITIALIZED → ignored", () => expect(map("INITIALIZED")).toBe("ignored"));
  it("an unknown status → ignored", () => expect(map("WHATEVER")).toBe("ignored"));

  it("builds a composite eventId for idempotency (id:status:timestamp)", () => {
    const ts = "1700000000";
    const { body, sig } = signed("whsec_test", ts, sub("ACTIVE"));
    const ev = createCashfreeProvider(cfg()).verifyAndParseWebhook(body, sig, ts);
    expect(ev.eventId).toBe("sub_1:ACTIVE:1700000000");
  });
});

describe("cashfree createSubscriptionCheckout", () => {
  it("posts to the sandbox endpoint with the caller-supplied subscription id and returns the link", async () => {
    let captured: { url: string; init: RequestInit } | undefined;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response(JSON.stringify({ authorization_details: { authorization_link: "https://pay/x" } }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const out = await createCashfreeProvider(cfg({ fetchImpl })).createSubscriptionCheckout({
      userId: "u1",
      email: "u@example.com",
      planId: "pro",
      providerPlanId: "cf_pro",
      subscriptionId: "sub_u1_123",
    });

    expect(out.url).toBe("https://pay/x");
    expect(captured?.url).toBe("https://sandbox.cashfree.com/pg/subscriptions");
    const body = JSON.parse(captured!.init.body as string);
    // The id we persist locally must be the SAME id Cashfree echoes back in webhooks.
    expect(body.subscription_id).toBe("sub_u1_123");
    expect(body.customer_details.customer_email).toBe("u@example.com");
    expect((captured!.init.headers as Record<string, string>)["x-client-id"]).toBe("app");
  });

  it("targets the production base url when env is production", async () => {
    let url = "";
    const fetchImpl = (async (u: string) => {
      url = u;
      return new Response(JSON.stringify({ authorization_details: { authorization_link: "x" } }), { status: 200 });
    }) as unknown as typeof fetch;
    await createCashfreeProvider(cfg({ env: "production", fetchImpl })).createSubscriptionCheckout({
      userId: "u",
      email: "e@x.com",
      planId: "pro",
      providerPlanId: "p",
      subscriptionId: "sub_1",
    });
    expect(url).toBe("https://api.cashfree.com/pg/subscriptions");
  });

  it("throws when Cashfree returns a non-OK response", async () => {
    const fetchImpl = (async () => new Response("bad request", { status: 400 })) as unknown as typeof fetch;
    await expect(
      createCashfreeProvider(cfg({ fetchImpl })).createSubscriptionCheckout({
        userId: "u",
        email: "e@x.com",
        planId: "pro",
        providerPlanId: "p",
        subscriptionId: "sub_1",
      }),
    ).rejects.toThrow(/failed/i);
  });

  it("throws when Cashfree omits the authorization link", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch;
    await expect(
      createCashfreeProvider(cfg({ fetchImpl })).createSubscriptionCheckout({
        userId: "u",
        email: "e@x.com",
        planId: "pro",
        providerPlanId: "p",
        subscriptionId: "sub_1",
      }),
    ).rejects.toThrow(/authorization link/i);
  });
});
