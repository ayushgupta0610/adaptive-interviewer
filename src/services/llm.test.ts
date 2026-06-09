import { describe, it, expect, vi } from "vitest";
import { createOpenRouterClient } from "./llm";

type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function fakeResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

describe("createOpenRouterClient", () => {
  it("posts messages to the chat-completions endpoint with auth + model", async () => {
    const fetchImpl = vi.fn<FetchFn>(async () => fakeResponse({ choices: [{ message: { content: "ok" } }] }));
    const client = createOpenRouterClient({ apiKey: "sk-test", model: "anthropic/claude-sonnet-4.6", fetchImpl });

    const out = await client.complete([{ role: "user", content: "hi" }]);

    expect(out).toBe("ok");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("/chat/completions");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe("anthropic/claude-sonnet-4.6");
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("allows a per-call model override", async () => {
    const fetchImpl = vi.fn<FetchFn>(async () => fakeResponse({ choices: [{ message: { content: "x" } }] }));
    const client = createOpenRouterClient({ apiKey: "k", model: "default/model", fetchImpl });
    await client.complete([{ role: "user", content: "hi" }], { model: "other/model" });
    const body = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string);
    expect(body.model).toBe("other/model");
  });

  it("throws on a non-ok response", async () => {
    const fetchImpl = vi.fn<FetchFn>(async () => fakeResponse({ error: "nope" }, false, 500));
    const client = createOpenRouterClient({ apiKey: "k", model: "m", fetchImpl });
    await expect(client.complete([{ role: "user", content: "hi" }])).rejects.toThrow();
  });
});
