/**
 * Per-session unit economics. Rates are in USD and are approximate — verify against
 * current pricing pages before relying on them for billing. See docs/unit-economics.md.
 *
 * Sources (2026-06):
 * - ElevenLabs Conversational AI: ~$0.10/min (Creator/Pro), $0.08/min (business overage),
 *   plus LLM pass-through. https://elevenlabs.io/pricing/agents
 * - Simli avatar: ~$0.05/min pay-as-you-go (Trinity-1 avatar can be <$0.01/min).
 *   https://www.simli.com/
 * - Claude Haiku 4.5: $1.00 / M input tokens, $5.00 / M output tokens.
 *   https://www.anthropic.com/news/claude-haiku-4-5
 */
export const RATES = {
  elevenLabsVoicePerMin: 0.1,
  simliAvatarPerMin: 0.05,
  llmInputPerMTok: 1.0,
  llmOutputPerMTok: 5.0,
} as const;

export interface SessionCostInput {
  /** Billed conversation minutes (drives voice + avatar cost). */
  minutes: number;
  /** ElevenLabs voice used (voice mode). */
  voice: boolean;
  /** Simli avatar used. */
  avatar: boolean;
  /** Total LLM input tokens across prepare + live turns + scoring (+ agent LLM for voice). */
  llmInputTokens: number;
  /** Total LLM output tokens. */
  llmOutputTokens: number;
}

export interface SessionCost {
  voice: number;
  avatar: number;
  llm: number;
  total: number;
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Estimate the provider cost (USD) of one interview session. */
export function estimateSessionCost(input: SessionCostInput, rates = RATES): SessionCost {
  const voice = input.voice ? input.minutes * rates.elevenLabsVoicePerMin : 0;
  const avatar = input.avatar ? input.minutes * rates.simliAvatarPerMin : 0;
  const llm =
    (input.llmInputTokens / 1_000_000) * rates.llmInputPerMTok +
    (input.llmOutputTokens / 1_000_000) * rates.llmOutputPerMTok;
  return { voice: round(voice), avatar: round(avatar), llm: round(llm), total: round(voice + avatar + llm) };
}

/** Suggested list price for a target gross margin (e.g. 0.7 = 70%). */
export function priceForMargin(cost: number, margin: number): number {
  return round(cost / (1 - margin));
}
