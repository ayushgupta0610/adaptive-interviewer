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
