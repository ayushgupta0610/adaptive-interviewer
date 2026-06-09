import { z } from "zod";
import { GuidelinesSchema } from "@/domain/schemas";
import { buildInterviewerSession } from "@/core/sessionConfig";
import { buildElevenLabsOverrides } from "@/services/elevenlabs";
import { prepareInterview } from "@/usecases/prepare";
import { getLlm, getPlanCache, interviewModel } from "@/services/runtime";
import { errorResponse } from "@/services/http";

const BodySchema = z.object({
  jd: z.string().min(20, "Job description is too short (min 20 chars)."),
  guidelines: GuidelinesSchema,
});

export async function POST(request: Request) {
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
      systemPrompt: session.systemPrompt,
      firstMessage: session.firstMessage,
      overrides: buildElevenLabsOverrides(session),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
