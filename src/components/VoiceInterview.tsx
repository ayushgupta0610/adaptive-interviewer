"use client";

import { useEffect, useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import type { InterviewPlan, Transcript } from "@/domain/schemas";
import type { PrepareResponse } from "@/lib/api";
import Webcam from "./Webcam";
import CompetencyRail from "./CompetencyRail";
import SimliAvatar, { type SimliHandle } from "./SimliAvatar";
import { Button, Card } from "@/components/ui";

/** Decode an ElevenLabs base64 audio chunk into raw PCM bytes for Simli. */
function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function Room({
  agentId,
  overrides,
  plan,
  simliEnabled,
  onComplete,
}: {
  agentId: string;
  overrides: PrepareResponse["overrides"];
  plan: InterviewPlan;
  simliEnabled: boolean;
  onComplete: (t: Transcript, conversationId?: string) => void;
}) {
  const turnsRef = useRef<Transcript>([]);
  const convoIdRef = useRef<string | null>(null);
  const avatarRef = useRef<SimliHandle>(null);
  const [turns, setTurns] = useState<Transcript>([]);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const convo = useConversation({
    onConnect: ({ conversationId }) => {
      convoIdRef.current = conversationId;
      setStarted(true);
    },
    onDisconnect: () => onComplete(turnsRef.current, convoIdRef.current ?? undefined),
    onMessage: ({ source, message }) => {
      const text = (message ?? "").trim();
      if (!text) return;
      turnsRef.current = [...turnsRef.current, { role: source === "ai" ? "interviewer" : "candidate", text }];
      setTurns(turnsRef.current);
    },
    // Tap the agent's audio for the avatar (Pattern A; fires in websocket mode).
    onAudio: (base64: string) => {
      if (simliEnabled && base64) avatarRef.current?.sendAudio(decodeBase64(base64));
    },
    onError: (m) => setError(typeof m === "string" ? m : "Voice error"),
  });

  // When the avatar drives audio, mute ElevenLabs' own playback so Simli is the
  // single, lip-synced A/V source.
  useEffect(() => {
    if (started && simliEnabled) convo.setVolume({ volume: 0 });
  }, [started, simliEnabled, convo]);

  function start() {
    setError(null);
    try {
      convo.startSession({ agentId, connectionType: "webrtc", overrides });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the session");
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <Card className="flex h-[62vh] flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {turns.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-2xl">🎙</span>
              <p className="mt-3 text-sm">Press start, allow your mic, and answer out loud.</p>
              <p className="text-xs">The live transcript appears here.</p>
            </div>
          )}
          {turns.map((t, i) =>
            t.role === "interviewer" ? (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">AI</span>
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-2.5 text-sm leading-relaxed text-slate-800">{t.text}</div>
              </div>
            ) : (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-indigo-500 to-indigo-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">{t.text}</div>
              </div>
            ),
          )}
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 p-3">
          <span className="flex items-center gap-2 text-sm text-slate-500">
            <span className={`h-2 w-2 rounded-full ${started ? "animate-pulse bg-emerald-500" : "bg-slate-300"}`} />
            {started ? (convo.isSpeaking ? "Interviewer speaking" : "Listening…") : "Not started"}
          </span>
          {!started ? (
            <Button onClick={start}>Start interview</Button>
          ) : (
            <Button variant="danger" onClick={() => convo.endSession()}>End &amp; get feedback</Button>
          )}
        </div>
        {error && <p className="px-4 pb-3 text-sm text-rose-600">{error}</p>}
      </Card>

      <div className="space-y-4">
        {simliEnabled && (
          <Card className="overflow-hidden p-2">
            {started ? (
              <SimliAvatar ref={avatarRef} onError={(m) => setError(m)} />
            ) : (
              <div className="grid aspect-video w-full place-items-center rounded-xl bg-slate-100 text-center text-xs text-slate-400">
                Interviewer avatar appears when you start
              </div>
            )}
            <p className="px-1 pt-1.5 text-[11px] text-slate-400">AI interviewer</p>
          </Card>
        )}
        <Card className="overflow-hidden p-2">
          <Webcam recording={started} />
          <p className="px-1 pt-1.5 text-[11px] text-slate-400">You</p>
        </Card>
        <CompetencyRail plan={plan} />
      </div>
    </div>
  );
}

export default function VoiceInterview(props: {
  agentId: string;
  overrides: PrepareResponse["overrides"];
  plan: InterviewPlan;
  simliEnabled: boolean;
  onComplete: (t: Transcript, conversationId?: string) => void;
}) {
  return (
    <ConversationProvider>
      <Room {...props} />
    </ConversationProvider>
  );
}
