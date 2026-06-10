import { z } from "zod";
import { interviewerTurn } from "@/usecases/turn";
import { getLlm, interviewModel } from "@/services/runtime";
import { errorResponse } from "@/services/http";

export const maxDuration = 60;

const BodySchema = z.object({
  systemPrompt: z.string().min(1),
  messages: z
    .array(z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string() }))
    .max(200),
});

/** Text-mode interview: returns the next interviewer message given the chat so far. */
export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json());
    const reply = await interviewerTurn(body, { llm: getLlm(), model: interviewModel() });
    return Response.json({ reply });
  } catch (err) {
    return errorResponse(err);
  }
}
