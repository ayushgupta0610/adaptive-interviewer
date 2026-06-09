import type { ChatMessage } from "../core/chat";
import type { LlmClient } from "../services/llm";

/**
 * One interviewer turn for the text-mode interview: given the interviewer system
 * prompt and the conversation so far, produce the next interviewer message. The
 * adaptivity is the same prompt that drives the voice agent — just text instead of
 * audio. Used by the type-instead path and the OpenRouter-only local flow.
 */
export async function interviewerTurn(
  input: { systemPrompt: string; messages: ChatMessage[] },
  deps: { llm: LlmClient; model?: string },
): Promise<string> {
  const reply = await deps.llm.complete(
    [{ role: "system", content: input.systemPrompt }, ...input.messages],
    deps.model ? { model: deps.model } : undefined,
  );
  return reply.trim();
}
