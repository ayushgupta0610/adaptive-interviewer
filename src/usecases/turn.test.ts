import { describe, it, expect, vi } from "vitest";
import { interviewerTurn } from "./turn";
import type { LlmClient } from "../services/llm";

describe("interviewerTurn", () => {
  it("prepends the system prompt and returns the trimmed reply", async () => {
    const llm: LlmClient = { complete: vi.fn(async () => "  So, walk me through your approach.  ") };
    const reply = await interviewerTurn(
      { systemPrompt: "You are an interviewer.", messages: [{ role: "user", content: "Hi" }] },
      { llm },
    );

    expect(reply).toBe("So, walk me through your approach.");
    const sentMessages = (llm.complete as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sentMessages[0]).toEqual({ role: "system", content: "You are an interviewer." });
    expect(sentMessages[1]).toEqual({ role: "user", content: "Hi" });
  });
});
