"use client";

import { useState } from "react";
import type { ChatMessage } from "@/core/chat";
import type { Transcript } from "@/domain/schemas";
import { apiTurn } from "@/lib/api";

export default function TextInterview({
  systemPrompt,
  firstMessage,
  onComplete,
}: {
  systemPrompt: string;
  firstMessage: string;
  onComplete: (t: Transcript) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: firstMessage }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: input.trim() }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const { reply } = await apiTurn(systemPrompt, next);
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Turn failed");
    } finally {
      setBusy(false);
    }
  }

  function finish() {
    const transcript: Transcript = messages.map((m) => ({
      role: m.role === "assistant" ? "interviewer" : "candidate",
      text: m.content,
    }));
    onComplete(transcript);
  }

  return (
    <div className="space-y-4">
      <div className="h-[55vh] space-y-3 overflow-y-auto rounded-lg border border-zinc-200 p-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "assistant" ? "text-left" : "text-right"}>
            <span
              className={`inline-block max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                m.role === "assistant" ? "bg-zinc-100 text-zinc-900" : "bg-zinc-900 text-white"
              }`}
            >
              {m.content}
            </span>
            <div className="mt-0.5 text-xs text-zinc-400">{m.role === "assistant" ? "Interviewer" : "You"}</div>
          </div>
        ))}
        {busy && <div className="text-sm text-zinc-400">Interviewer is thinking…</div>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={send} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your answer…"
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <button type="submit" disabled={busy} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          Send
        </button>
      </form>

      <button onClick={finish} className="text-sm font-medium text-blue-600 underline">
        Finish interview &amp; get feedback →
      </button>
    </div>
  );
}
