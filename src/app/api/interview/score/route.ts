import { z } from "zod";
import { InterviewPlanSchema, TranscriptSchema } from "@/domain/schemas";
import { scoreInterview } from "@/usecases/score";
import { getLlm, getRepo, getVoice, interviewModel } from "@/services/runtime";
import { errorResponse } from "@/services/http";
import { enforceRateLimit } from "@/services/rateLimit";

export const maxDuration = 60;

// Memory mode: client supplies the plan + transcript directly (no persistence).
const DirectSchema = z.object({
  plan: InterviewPlanSchema,
  transcript: TranscriptSchema.min(1, "Transcript is empty.").max(500, "Transcript is too long."),
});

// Supabase mode: persist + score a finished voice conversation.
const SessionSchema = z.object({
  interviewId: z.string().min(1),
  candidateId: z.string().min(1),
  conversationId: z.string().min(1),
  recordingUrl: z.string().url().optional(),
});

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "score", 15);
  if (limited) return limited;
  try {
    const raw = await request.json();

    const direct = DirectSchema.safeParse(raw);
    if (direct.success) {
      const report = await scoreInterview(direct.data, { llm: getLlm(), model: interviewModel() });
      return Response.json({ report });
    }

    const s = SessionSchema.parse(raw);
    const repo = getRepo();
    const plan = await repo.getPlanForInterview(s.interviewId);
    if (!plan) return Response.json({ error: "Interview not found" }, { status: 404 });

    await repo.ensureCandidate(s.candidateId);
    const sessionId = await repo.createSession({ interviewId: s.interviewId, candidateId: s.candidateId });
    await repo.attachConversation(sessionId, s.conversationId);
    const transcript = await getVoice().getConversationTranscript(s.conversationId);
    await repo.completeSession(sessionId, transcript, s.recordingUrl);
    const report = await scoreInterview({ plan, transcript }, { llm: getLlm(), model: interviewModel() });
    await repo.saveFeedback(sessionId, report);
    return Response.json({ sessionId, report });
  } catch (err) {
    return errorResponse(err);
  }
}
