import type { BillingEvent } from "../../domain/billing";

export interface PaymentProvider {
  createSubscriptionCheckout(input: {
    userId: string;
    email: string;
    planId: string;
    providerPlanId: string;
  }): Promise<{ url: string }>;
  verifyAndParseWebhook(rawBody: string, signature: string, timestamp: string): BillingEvent;
}
