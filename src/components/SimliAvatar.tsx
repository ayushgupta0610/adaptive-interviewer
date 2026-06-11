"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { apiSimliSession } from "@/lib/api";

export interface SimliHandle {
  sendAudio: (bytes: Uint8Array) => void;
  clear: () => void;
}

/** Minimal structural view of the simli-client SimliClient (loaded dynamically). */
interface SimliClientLike {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  sendAudioData: (b: Uint8Array) => void;
  ClearBuffer: () => void;
  on: (event: string, cb: (detail: string) => void) => void;
}
type SimliCtor = new (
  token: string,
  video: HTMLVideoElement,
  audio: HTMLAudioElement,
  ice: RTCIceServer[] | null,
) => SimliClientLike;

/**
 * Talking-head avatar (Pattern A). Mints a session server-side, then drives the
 * browser SimliClient. Parent pushes the ElevenLabs agent's audio via the ref.
 * Experimental — gated on Simli config; renders nothing harmful if it fails.
 */
const SimliAvatar = forwardRef<SimliHandle, { onError?: (m: string) => void }>(function SimliAvatar(
  { onError },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const clientRef = useRef<SimliClientLike | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const [state, setState] = useState<"connecting" | "ready" | "error">("connecting");

  useImperativeHandle(
    ref,
    () => ({
      sendAudio: (bytes) => clientRef.current?.sendAudioData(bytes),
      clear: () => clientRef.current?.ClearBuffer(),
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { sessionToken, iceServers } = await apiSimliSession();
        if (cancelled || !videoRef.current || !audioRef.current) return;
        const mod = await import("simli-client");
        const SimliClient = mod.SimliClient as unknown as SimliCtor;
        const client = new SimliClient(sessionToken, videoRef.current, audioRef.current, iceServers ?? null);
        client.on("error", (d) => {
          if (!cancelled) {
            onErrorRef.current?.(d);
            setState("error");
          }
        });
        await client.start();
        if (cancelled) {
          client.stop().catch(() => undefined);
          return;
        }
        clientRef.current = client;
        setState("ready");
      } catch (e) {
        if (!cancelled) {
          onErrorRef.current?.(e instanceof Error ? e.message : "Avatar failed to start");
          setState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
      clientRef.current?.stop().catch(() => undefined);
      clientRef.current = null;
    };
  }, []);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-900">
      <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
      <audio ref={audioRef} autoPlay />
      {state !== "ready" && (
        <div className="absolute inset-0 grid place-items-center text-sm text-slate-300">
          {state === "error" ? "Avatar unavailable" : "Loading interviewer avatar…"}
        </div>
      )}
    </div>
  );
});

export default SimliAvatar;
