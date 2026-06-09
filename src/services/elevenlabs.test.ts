import { describe, it, expect, vi } from "vitest";
import { buildElevenLabsOverrides, createElevenLabsVoice } from "./elevenlabs";

type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function fakeResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

describe("buildElevenLabsOverrides", () => {
  it("maps the interviewer session into the agent override payload", () => {
    const overrides = buildElevenLabsOverrides({ systemPrompt: "be an interviewer", firstMessage: "hello" });
    expect(overrides).toEqual({
      agent: { prompt: { prompt: "be an interviewer" }, firstMessage: "hello" },
    });
  });
});

describe("createElevenLabsVoice.getConversationTranscript", () => {
  it("fetches with the api key header and normalizes the transcript", async () => {
    const fetchImpl = vi.fn<FetchFn>(async () =>
      fakeResponse({
        transcript: [
          { role: "agent", message: "Q1" },
          { role: "user", message: "A1" },
        ],
      }),
    );
    const voice = createElevenLabsVoice({ apiKey: "xi-test", fetchImpl });

    const turns = await voice.getConversationTranscript("conv_123");

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("conv_123");
    expect(((init as RequestInit).headers as Record<string, string>)["xi-api-key"]).toBe("xi-test");
    expect(turns).toEqual([
      { role: "interviewer", text: "Q1" },
      { role: "candidate", text: "A1" },
    ]);
  });

  it("throws on a non-ok response", async () => {
    const fetchImpl = vi.fn<FetchFn>(async () => fakeResponse({}, false));
    const voice = createElevenLabsVoice({ apiKey: "k", fetchImpl });
    await expect(voice.getConversationTranscript("c")).rejects.toThrow();
  });
});
