import type { ChatMessage } from "../core/chat";

export interface LlmCompleteOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/** Port: the only thing the use-cases need from an LLM. */
export interface LlmClient {
  complete(messages: ChatMessage[], opts?: LlmCompleteOptions): Promise<string>;
}

type FetchImpl = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  /** Injectable for testing; defaults to global fetch. */
  fetchImpl?: FetchImpl;
  /** Optional OpenRouter attribution headers. */
  referer?: string;
  title?: string;
}

/**
 * OpenRouter client (OpenAI-compatible /chat/completions). Also the same endpoint
 * the ElevenLabs agent's custom LLM points at for the live interview.
 */
export function createOpenRouterClient(config: OpenRouterConfig): LlmClient {
  const baseUrl = config.baseUrl ?? "https://openrouter.ai/api/v1";
  const doFetch = config.fetchImpl ?? fetch;
  return {
    async complete(messages, opts) {
      const res = await doFetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          ...(config.referer ? { "HTTP-Referer": config.referer } : {}),
          ...(config.title ? { "X-Title": config.title } : {}),
        },
        body: JSON.stringify({
          model: opts?.model ?? config.model,
          messages,
          ...(opts?.temperature !== undefined ? { temperature: opts.temperature } : {}),
          ...(opts?.maxTokens !== undefined ? { max_tokens: opts.maxTokens } : {}),
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`OpenRouter request failed (${res.status}): ${detail}`);
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("OpenRouter response missing message content");
      return content;
    },
  };
}
