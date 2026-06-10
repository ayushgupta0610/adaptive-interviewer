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

describe("createElevenLabsVoice.getConversationAnalysis", () => {
  it("fetches and normalizes post-call analysis", async () => {
    const fetchImpl = vi.fn<FetchFn>(async () =>
      fakeResponse({
        status: "done",
        analysis: {
          transcript_summary: "Interview summary.",
          evaluation_criteria_results: { technical_depth: { result: "success", rationale: "Good." } },
          data_collection_results: { key_strength: { value: "system design" } },
        },
      }),
    );
    const voice = createElevenLabsVoice({ apiKey: "xi", fetchImpl });
    const a = await voice.getConversationAnalysis("conv_9");
    expect(String(fetchImpl.mock.calls[0][0])).toContain("conv_9");
    expect(a.ready).toBe(true);
    expect(a.criteria[0].id).toBe("technical_depth");
    expect(a.data[0]).toEqual({ key: "key_strength", value: "system design", rationale: undefined });
  });
});
