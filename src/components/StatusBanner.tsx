"use client";

import { useEffect, useState } from "react";
import { apiStatus, type StatusResponse } from "@/lib/api";

function Dot({ ok }: { ok: boolean }) {
  return <span className={ok ? "text-green-600" : "text-zinc-400"}>{ok ? "●" : "○"}</span>;
}

export default function StatusBanner() {
  const [s, setS] = useState<StatusResponse | null>(null);
  useEffect(() => {
    apiStatus().then(setS).catch(() => setS(null));
  }, []);
  if (!s) return null;
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-600">
      <span className="mr-4">
        <Dot ok={s.openrouter} /> LLM {s.openrouter ? `(${s.model})` : "— required"}
      </span>
      <span className="mr-4">
        <Dot ok={s.elevenlabs} /> ElevenLabs voice {s.elevenlabs ? "" : "— text mode only"}
      </span>
      <span>
        <Dot ok={s.supabase} /> Supabase {s.supabase ? "" : "— in-memory cache"}
      </span>
      {!s.openrouter && (
        <p className="mt-1 text-amber-700">
          Add OPENROUTER_API_KEY to .env.local to run interviews. See .env.example.
        </p>
      )}
    </div>
  );
}
