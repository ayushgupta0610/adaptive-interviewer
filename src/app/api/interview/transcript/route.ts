import { z } from "zod";
import { getVoice } from "@/services/runtime";
import { errorResponse } from "@/services/http";
import { enforceRateLimit } from "@/services/rateLimit";

export const maxDuration = 60;

const BodySchema = z.object({ conversationId: z.string().min(1).max(100) });

/** Fetch the official ElevenLabs transcript for a finished conversation. */
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, "transcript", 30);
  if (limited) return limited;
  try {
    const { conversationId } = BodySchema.parse(await request.json());
    const transcript = await getVoice().getConversationTranscript(conversationId);
    return Response.json({ transcript });
  } catch (err) {
    return errorResponse(err);
  }
}
