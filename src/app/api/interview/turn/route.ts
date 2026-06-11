import { z } from "zod";
import { buildInterviewerSession } from "@/core/sessionConfig";
import { interviewerTurn } from "@/usecases/turn";
import { getLlm, getPlanCache, interviewModel } from "@/services/runtime";
import { errorResponse } from "@/services/http";
import { enforceRateLimit } from "@/services/rateLimit";
import { getUserId, unauthorized } from "@/services/auth";

export const maxDuration = 60;

// The client never supplies the system prompt — only which interview + the chat so far.
const BodySchema = z.object({
  interviewId: z.string().uuid(),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .min(1)
    .max(200),
});

/** Text-mode interview: returns the next interviewer message given the chat so far. */
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "turn", 60);
  if (limited) return limited;
  const userId = await getUserId(request);
  if (!userId) return unauthorized();
  try {
    const { interviewId, messages } = BodySchema.parse(await request.json());

    // Rebuild the interviewer prompt server-side from the stored interview, so the
    // endpoint can't be used as a free general-purpose LLM proxy.
    const source = await getPlanCache().getById(interviewId);
    if (!source) {
      return Response.json({ error: "Interview not found — please restart." }, { status: 404 });
    }
    const { systemPrompt } = buildInterviewerSession(source.plan, source.guidelines);

    const reply = await interviewerTurn({ systemPrompt, messages }, { llm: getLlm(), model: interviewModel() });
    return Response.json({ reply });
  } catch (err) {
    return errorResponse(err);
  }
}
