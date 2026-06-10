import { z } from "zod";
import { getVoice } from "@/services/runtime";
import { errorResponse } from "@/services/http";

export const maxDuration = 30;

const BodySchema = z.object({ conversationId: z.string().min(1) });

/** Fetch the ElevenLabs agent's post-call analysis (recruiter view) for a conversation. */
export async function POST(request: Request) {
  try {
    const { conversationId } = BodySchema.parse(await request.json());
    const analysis = await getVoice().getConversationAnalysis(conversationId);
    return Response.json({ analysis });
  } catch (err) {
    return errorResponse(err);
  }
}
