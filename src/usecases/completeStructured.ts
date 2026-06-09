import type { z } from "zod";
import { extractJson } from "../core/json";
import type { ChatMessage } from "../core/chat";
import type { LlmClient } from "../services/llm";

const RETRY_NUDGE =
  "Your previous response was not valid JSON matching the required schema. " +
  "Respond again with ONLY the JSON object — no prose, no code fences.";

/**
 * Call the LLM and parse+validate its output against a zod schema, retrying with a
 * corrective nudge on invalid output. This is the one place structured-output
 * reliability lives, shared by prepare() and score().
 */
export async function completeStructured<T>(
  llm: LlmClient,
  messages: ChatMessage[],
  schema: z.ZodType<T>,
  opts?: { model?: string; retries?: number },
): Promise<T> {
  const retries = opts?.retries ?? 1;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const msgs =
      attempt === 0 ? messages : [...messages, { role: "user" as const, content: RETRY_NUDGE }];
    const raw = await llm.complete(msgs, opts?.model ? { model: opts.model } : undefined);
    try {
      return schema.parse(extractJson(raw));
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `LLM did not return valid structured output after ${retries + 1} attempt(s): ${String(lastError)}`,
  );
}
