import type { Transcript } from "../domain/schemas";
import type { InterviewerSession } from "../core/sessionConfig";
import { normalizeTranscript } from "../core/transcript";

/**
 * Map our interviewer session into the ElevenLabs conversation `overrides` payload.
 * (Pure.) The browser SDK passes this when starting a session so the agent uses our
 * per-interview persona + opening line instead of the static dashboard prompt.
 */
export function buildElevenLabsOverrides(session: InterviewerSession) {
  return {
    agent: {
      prompt: { prompt: session.systemPrompt },
      firstMessage: session.firstMessage,
    },
  };
}

type FetchImpl = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/** Port: what the server needs from the voice provider after a call. */
export interface VoiceProvider {
  getConversationTranscript(conversationId: string): Promise<Transcript>;
}

export interface ElevenLabsConfig {
  apiKey: string;
  /** Base for the Conversational AI REST API; confirm exact path at integration. */
  baseUrl?: string;
  fetchImpl?: FetchImpl;
}

export function createElevenLabsVoice(config: ElevenLabsConfig): VoiceProvider {
  const baseUrl = config.baseUrl ?? "https://api.elevenlabs.io/v1/convai";
  const doFetch = config.fetchImpl ?? fetch;
  return {
    async getConversationTranscript(conversationId) {
      const res = await doFetch(`${baseUrl}/conversations/${conversationId}`, {
        method: "GET",
        headers: { "xi-api-key": config.apiKey },
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`ElevenLabs transcript fetch failed (${res.status}): ${detail}`);
      }
      const data = (await res.json()) as { transcript?: unknown };
      return normalizeTranscript(data.transcript);
    },
  };
}
