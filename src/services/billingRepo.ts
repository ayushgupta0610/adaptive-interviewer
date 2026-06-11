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
        .from("usage_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("billed_as", billedAs)
        .gte("created_at", sinceIso);
      return count ?? 0;
    },
    /** Record a session consumption into the usage ledger. */
    async recordUsage(userId: string, mode: string, billedAs: string): Promise<void> {
      await client.from("usage_events").insert({ user_id: userId, mode, billed_as: billedAs });
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
