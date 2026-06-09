import { describe, it, expect } from "vitest";
import { normalizeTranscript, formatTranscript } from "./transcript";

describe("normalizeTranscript", () => {
  it("maps ElevenLabs agent/user turns to interviewer/candidate", () => {
    const raw = [
      { role: "agent", message: "Tell me about a hard bug." },
      { role: "user", message: "I once debugged a race condition." },
    ];
    expect(normalizeTranscript(raw)).toEqual([
      { role: "interviewer", text: "Tell me about a hard bug." },
      { role: "candidate", text: "I once debugged a race condition." },
    ]);
  });

  it("tolerates assistant/human roles and content/text fields", () => {
    const raw = [
      { role: "assistant", content: "Q1" },
      { role: "human", text: "A1" },
    ];
    expect(normalizeTranscript(raw)).toEqual([
      { role: "interviewer", text: "Q1" },
      { role: "candidate", text: "A1" },
    ]);
  });

  it("drops empty/whitespace turns and unknown roles", () => {
    const raw = [
      { role: "agent", message: "   " },
      { role: "system", message: "ignore me" },
      { role: "user", message: "real answer" },
    ];
    expect(normalizeTranscript(raw)).toEqual([{ role: "candidate", text: "real answer" }]);
  });

  it("returns [] for non-array input", () => {
    expect(normalizeTranscript(null)).toEqual([]);
    expect(normalizeTranscript({ foo: 1 })).toEqual([]);
  });
});

describe("formatTranscript", () => {
  it("renders labelled lines", () => {
    const out = formatTranscript([
      { role: "interviewer", text: "Hi" },
      { role: "candidate", text: "Hello" },
    ]);
    expect(out).toBe("Interviewer: Hi\nCandidate: Hello");
  });
});
