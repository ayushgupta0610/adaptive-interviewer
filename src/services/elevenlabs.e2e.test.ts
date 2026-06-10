import { describe, it, expect } from "vitest";
import { normalizeTranscript } from "../core/transcript";

/**
 * Live ElevenLabs voice E2E (spec §9). Skipped unless ELEVENLABS_API_KEY +
 * NEXT_PUBLIC_ELEVENLABS_AGENT_ID are set, so the default suite stays green/offline.
 *
 * Run:  ELEVENLABS_API_KEY=... NEXT_PUBLIC_ELEVENLABS_AGENT_ID=agent_... \
 *         npx vitest run src/services/elevenlabs.e2e.test.ts
 *
 * Drives the agent headlessly via Simulate Conversations, then proves the returned
 * transcript normalizes into our interviewer/candidate turns.
 */
const apiKey = process.env.ELEVENLABS_API_KEY;
const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
const ready = !!apiKey && !!agentId;

describe.skipIf(!ready)("ElevenLabs agent simulate-conversation E2E", () => {
  it("runs a simulated interview and yields a normalizable transcript", { timeout: 180_000 }, async () => {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${agentId}/simulate-conversation`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey!, "Content-Type": "application/json" },
        body: JSON.stringify({
          simulation_specification: {
            simulated_user_config: {
              first_message: "",
              language: "en",
              prompt: {
                prompt:
                  "You are a candidate in a mock interview for a backend engineering role. Answer concisely and realistically in 2-3 sentences.",
              },
            },
          },
          new_turns_limit: 4,
        }),
      },
    );
    expect(res.ok).toBe(true);
    const data = (await res.json()) as { simulated_conversation?: { role: string; message: string }[] };
    const conv = data.simulated_conversation ?? [];
    expect(conv.length).toBeGreaterThan(0);

    const transcript = normalizeTranscript(conv);
    expect(transcript.length).toBeGreaterThan(0);
    expect(transcript.some((t) => t.role === "interviewer")).toBe(true);
  });
});
