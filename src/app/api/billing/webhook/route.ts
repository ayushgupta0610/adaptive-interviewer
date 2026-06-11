import { createCashfreeProvider } from "@/services/payments/cashfree";
import { createBillingRepo } from "@/services/billingRepo";
import { env, hasCashfreeWebhook } from "@/services/env";
import { enforceRateLimit } from "@/services/rateLimit";

export const maxDuration = 30;

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "webhook", 120);
  if (limited) return limited;

  if (!hasCashfreeWebhook) return Response.json({ error: "not configured" }, { status: 503 });
  const raw = await request.text();
  const signature = request.headers.get("x-webhook-signature") ?? "";
  const timestamp = request.headers.get("x-webhook-timestamp") ?? "";

  const tsNum = Number(timestamp);
  if (!tsNum || Math.abs(Date.now() / 1000 - tsNum) > 300) {
    return Response.json({ error: "stale webhook" }, { status: 401 });
  }

  const provider = createCashfreeProvider({
    appId: env.CASHFREE_APP_ID!,
    secretKey: env.CASHFREE_SECRET_KEY!,
    webhookSecret: env.CASHFREE_WEBHOOK_SECRET!,
    env: env.CASHFREE_ENV,
  });

  let event;
  try {
    event = provider.verifyAndParseWebhook(raw, signature, timestamp);
  } catch {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }
  if (event.type === "ignored" || !event.providerSubscriptionId) return Response.json({ ok: true });

  const status =
    event.type === "subscription_active"
      ? "active"
      : event.type === "subscription_cancelled"
        ? "cancelled"
        : "expired";

  await createBillingRepo().upsertSubscriptionByProviderId({
    providerSubscriptionId: event.providerSubscriptionId,
    status,
    currentPeriodEnd: event.currentPeriodEnd,
  });
  return Response.json({ ok: true });
}
