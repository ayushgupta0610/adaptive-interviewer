import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { createCashfreeProvider } from "./cashfree";

describe("cashfree webhook verify", () => {
  it("accepts a correctly signed webhook and maps the event", () => {
    const secret = "whsec_test";
    const ts = "1700000000";
    const body = JSON.stringify({
      type: "SUBSCRIPTION_STATUS_CHANGED",
      data: {
        subscription: {
          subscription_id: "sub_1",
          subscription_status: "ACTIVE",
          current_cycle_end: "2026-07-01",
        },
      },
    });
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
