import { z } from "zod";
import { GuidelinesSchema } from "@/domain/schemas";
import { buildInterviewerSession } from "@/core/sessionConfig";
import { buildElevenLabsOverrides } from "@/services/elevenlabs";
import { prepareInterview } from "@/usecases/prepare";
import { getLlm, getPlanCache, interviewModel } from "@/services/runtime";
import { errorResponse } from "@/services/http";
import { enforceRateLimit } from "@/services/rateLimit";
import { getUserId, unauthorized } from "@/services/auth";

// Plan generation is an LLM call; allow headroom over Vercel's default timeout.
export const maxDuration = 60;

const BodySchema = z.object({
  jd: z.string().min(20, "Job description is too short (min 20 chars).").max(20000, "Job description is too long."),
  guidelines: GuidelinesSchema,
});

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "prepare", 15);
  if (limited) return limited;
  const userId = await getUserId(request);
  if (!userId) return unauthorized();
  try {
    const body = BodySchema.parse(await request.json());
    const result = await prepareInterview(
      { jd: body.jd, guidelines: body.guidelines },
      { llm: getLlm(), cache: getPlanCache(), model: interviewModel() },
    );
    const session = buildInterviewerSession(result.plan, body.guidelines);
    return Response.json({
      interviewId: result.interviewId,
      plan: result.plan,
      cached: result.cached,
      fallback: result.fallback,
      systemPrompt: session.systemPrompt,
      firstMessage: session.firstMessage,
      overrides: buildElevenLabsOverrides(session),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
