"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/core/chat";
import type { InterviewPlan, Transcript } from "@/domain/schemas";
import { apiTurn } from "@/lib/api";
import { Button, Card, Spinner } from "@/components/ui";
import CompetencyRail from "@/components/CompetencyRail";

export default function TextInterview({
  systemPrompt,
  firstMessage,
  plan,
  onComplete,
}: {
  systemPrompt: string;
  firstMessage: string;
  plan: InterviewPlan;
  onComplete: (t: Transcript) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: firstMessage }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

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

  const answers = messages.filter((m) => m.role === "user").length;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
      <Card className="flex h-[62vh] flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.map((m, i) =>
            m.role === "assistant" ? (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">AI</span>
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-2.5 text-sm leading-relaxed text-slate-800">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-indigo-500 to-indigo-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">
                  {m.content}
                </div>
              </div>
            ),
          )}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Spinner className="h-4 w-4" /> Interviewer is thinking…
            </div>
          )}
        </div>

        {error && <p className="px-5 pb-2 text-sm text-rose-600">{error}</p>}

        <form onSubmit={send} className="flex items-center gap-2 border-t border-slate-200 p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your answer…"
            className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <Button type="submit" disabled={busy}>Send</Button>
        </form>
      </Card>

      <div className="space-y-4">
        <CompetencyRail plan={plan} />
        <Button variant="secondary" onClick={finish} className="w-full" disabled={answers === 0}>
          Finish &amp; get feedback
        </Button>
        <p className="text-center text-xs text-slate-400">{answers} answer{answers === 1 ? "" : "s"} given</p>
      </div>
    </div>
  );
}
