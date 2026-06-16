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
    // Active subscribers get unlimited text; free users are capped per day.
    if (i.subscription && i.subscription.status === "active") {
      return { allowed: true, reason: "ok", consume: "free_text" };
    }
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
