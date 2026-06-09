"use client";

import { useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import type { Transcript } from "@/domain/schemas";
import type { PrepareResponse } from "@/lib/api";
import Webcam from "./Webcam";

function Room({
  agentId,
  overrides,
  onComplete,
}: {
  agentId: string;
  overrides: PrepareResponse["overrides"];
  onComplete: (t: Transcript) => void;
}) {
  // Ref is the source of truth for the final transcript (read in the disconnect
  // handler); state mirrors it for rendering the live transcript.
  const turnsRef = useRef<Transcript>([]);
  const [turns, setTurns] = useState<Transcript>([]);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const convo = useConversation({
    onConnect: () => setStarted(true),
    onDisconnect: () => onComplete(turnsRef.current),
    onMessage: ({ source, message }) => {
      const text = (message ?? "").trim();
      if (!text) return;
      turnsRef.current = [...turnsRef.current, { role: source === "ai" ? "interviewer" : "candidate", text }];
      setTurns(turnsRef.current);
    },
    onError: (m) => setError(typeof m === "string" ? m : "Voice error"),
  });

  function start() {
    setError(null);
    try {
      convo.startSession({ agentId, connectionType: "webrtc", overrides });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the session");
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-3">
        <Webcam recording={started} />
        <div className="flex items-center gap-3">
          {!started ? (
            <button onClick={start} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
              Start interview
            </button>
          ) : (
            <button onClick={() => convo.endSession()} className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white">
              End &amp; get feedback
            </button>
          )}
          <span className="text-sm text-zinc-500">
            {convo.status}
            {started ? ` · ${convo.isSpeaking ? "interviewer speaking" : "listening"}` : ""}
          </span>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <p className="text-xs text-zinc-400">Allow microphone &amp; camera access when prompted.</p>
      </div>

      <div className="h-[55vh] space-y-3 overflow-y-auto rounded-lg border border-zinc-200 p-4">
        {turns.length === 0 && <p className="text-sm text-zinc-400">Live transcript will appear here…</p>}
        {turns.map((t, i) => (
          <div key={i} className={t.role === "interviewer" ? "text-left" : "text-right"}>
            <span
              className={`inline-block max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                t.role === "interviewer" ? "bg-zinc-100 text-zinc-900" : "bg-zinc-900 text-white"
              }`}
            >
              {t.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function VoiceInterview(props: {
  agentId: string;
  overrides: PrepareResponse["overrides"];
  onComplete: (t: Transcript) => void;
}) {
  return (
    <ConversationProvider>
      <Room {...props} />
    </ConversationProvider>
  );
}
