"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Candidate webcam: live preview + optional local recording (downloadable). Uploading
 * the blob to Supabase Storage is the remaining wire-up; `recording_url` already exists
 * in the schema for it.
 */
export default function Webcam({ recording }: { recording: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((e) => setError(`Camera unavailable: ${e instanceof Error ? e.message : String(e)}`));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    if (recording && !recorderRef.current) {
      chunksRef.current = [];
      try {
        const rec = new MediaRecorder(stream);
        rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
        rec.onstop = () => setDownloadUrl(URL.createObjectURL(new Blob(chunksRef.current, { type: "video/webm" })));
        rec.start();
        recorderRef.current = rec;
      } catch {
        /* recording unsupported — preview still works */
      }
    } else if (!recording && recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
  }, [recording]);

  if (error) {
    return <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">{error} (interview continues without video)</div>;
  }

  return (
    <div className="space-y-2">
      <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full rounded-lg bg-black object-cover" />
      {downloadUrl && (
        <a href={downloadUrl} download="interview-recording.webm" className="text-sm text-blue-600 underline">
          Download your recording
        </a>
      )}
    </div>
  );
}
