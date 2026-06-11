import { z } from "zod";
import { getUserId, unauthorized } from "@/services/auth";
import { createServiceClient } from "@/services/supabase";
import { createCashfreeProvider } from "@/services/payments/cashfree";
import { env, hasCashfree } from "@/services/env";
import { ServiceUnavailableError } from "@/services/runtime";
import { errorResponse } from "@/services/http";
import { enforceRateLimit } from "@/services/rateLimit";

export const maxDuration = 30;
const Body = z.object({ planId: z.enum(["starter", "pro"]) });

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "checkout", 10);
  if (limited) return limited;
  try {
    if (!hasCashfree) throw new ServiceUnavailableError("Payments not configured.");
    const userId = await getUserId(request);
    if (!userId) return unauthorized();
    const { planId } = Body.parse(await request.json());

    const db = createServiceClient();
    const { data: plan } = await db.from("plans").select("provider_plan_id").eq("id", planId).maybeSingle();
    const { data: user } = await db.auth.admin.getUserById(userId);
    if (!plan?.provider_plan_id) throw new Error("Plan is missing a Cashfree plan id.");

    const provider = createCashfreeProvider({
      appId: env.CASHFREE_APP_ID!,
      secretKey: env.CASHFREE_SECRET_KEY!,
      webhookSecret: env.CASHFREE_WEBHOOK_SECRET ?? "",
      env: env.CASHFREE_ENV,
    });
    const { url } = await provider.createSubscriptionCheckout({
      userId,
      email: user.user?.email ?? "",
      planId,
      providerPlanId: plan.provider_plan_id,
    });
    return Response.json({ url });
  } catch (err) {
    return errorResponse(err);
  }
}
