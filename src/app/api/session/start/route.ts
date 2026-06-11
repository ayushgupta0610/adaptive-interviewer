import { z } from "zod";
import { getUserId, unauthorized } from "@/services/auth";
import { createBillingRepo } from "@/services/billingRepo";
import { canStartSession } from "@/core/entitlement";
import { env, hasSupabaseService } from "@/services/env";
import { errorResponse } from "@/services/http";
import { enforceRateLimit } from "@/services/rateLimit";

export const maxDuration = 30;
const Body = z.object({ mode: z.enum(["text", "voice"]) });

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "session-start", 30);
  if (limited) return limited;
  try {
    const userId = await getUserId(request);
    if (!userId) return unauthorized();
    if (!hasSupabaseService) return Response.json({ error: "not configured" }, { status: 503 });
    const { mode } = Body.parse(await request.json());

    const repo = createBillingRepo();
    const profile = (await repo.getProfile(userId)) ?? { freeTrialUsed: false };
    const sub = await repo.getActiveSubscription(userId);
    const periodStart = sub?.currentPeriodStart ?? new Date(Date.now() - 30 * 864e5).toISOString();
    const todayStart = new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString();

    const result = canStartSession({
      mode,
      freeTrialUsed: profile.freeTrialUsed,
      subscription:
        sub && sub.status === "active" ? { status: "active", quota: sub.monthlyQuota } : null,
      paidSessionsThisPeriod: await repo.countSessionsSince(userId, "subscription", periodStart),
      freeTextToday: await repo.countSessionsSince(userId, "free_text", todayStart),
      freeTextDailyCap: env.FREE_TEXT_DAILY_CAP,
    });
    if (!result.allowed)
      return Response.json({ allowed: false, reason: result.reason }, { status: 402 });

    if (result.consume === "free_trial") {
      const claimed = await repo.claimFreeTrial(userId);
      if (!claimed) return Response.json({ allowed: false, reason: "trial_used" }, { status: 402 });
    }
    if (result.consume !== "none") await repo.recordUsage(userId, mode, result.consume);
    return Response.json({ allowed: true, billedAs: result.consume });
  } catch (err) {
    return errorResponse(err);
  }
}
