import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProvider } from "./provider";
import type { BillingEvent } from "../../domain/billing";

interface Cfg {
  appId: string;
  secretKey: string;
  webhookSecret: string;
  env: "sandbox" | "production";
  fetchImpl?: typeof fetch;
}

const BASE = {
  sandbox: "https://sandbox.cashfree.com/pg",
  production: "https://api.cashfree.com/pg",
};

function mapStatus(s: string): BillingEvent["type"] {
  switch (s.toUpperCase()) {
    case "ACTIVE":
      return "subscription_active";
    case "BANK_APPROVAL_PENDING":
    case "INITIALIZED":
      return "ignored";
    case "CANCELLED":
      return "subscription_cancelled";
    case "COMPLETED":
    case "EXPIRED":
      return "subscription_expired";
    default:
      return "ignored";
  }
}

export function createCashfreeProvider(cfg: Cfg): PaymentProvider {
  const doFetch = cfg.fetchImpl ?? fetch;
  return {
    async createSubscriptionCheckout({ userId, email, providerPlanId, subscriptionId }) {
      const res = await doFetch(`${BASE[cfg.env]}/subscriptions`, {
        method: "POST",
        headers: {
          "x-client-id": cfg.appId,
          "x-client-secret": cfg.secretKey,
          "x-api-version": "2023-08-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscription_id: subscriptionId,
          plan_details: { plan_id: providerPlanId },
          customer_details: { customer_email: email, customer_id: userId },
          subscription_meta: { return_url: `${process.env.APP_URL ?? ""}/account` },
        }),
      });
      if (!res.ok) {
        throw new Error(
          `Cashfree create subscription failed (${res.status}): ${await res.text().catch(() => "")}`,
        );
      }
      const data = (await res.json()) as {
        subscription_session_id?: string;
        authorization_details?: { authorization_link?: string };
      };
      const url = data.authorization_details?.authorization_link;
      if (!url) throw new Error("Cashfree did not return an authorization link");
      return { url };
    },

    verifyAndParseWebhook(rawBody, signature, timestamp) {
      if (!cfg.webhookSecret) throw new Error("Webhook secret not configured");
      const expected = createHmac("sha256", cfg.webhookSecret)
        .update(timestamp + rawBody)
        .digest("base64");
      const a = Buffer.from(expected);
      const b = Buffer.from(signature);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new Error("Invalid webhook signature");
      }
      const parsed = JSON.parse(rawBody) as {
        type?: string;
        data?: {
          subscription?: {
            subscription_id?: string;
            subscription_status?: string;
            current_cycle_end?: string;
          };
        };
      };
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
