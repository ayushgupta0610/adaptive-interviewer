"use client";

import { useEffect, useState } from "react";
import { apiStatus, type StatusResponse } from "@/lib/api";
import { Logo, Badge } from "@/components/ui";
import { useAccessToken } from "@/components/AuthGate";
import { isSupabaseConfigured, supabaseBrowser } from "@/lib/supabaseBrowser";
import LandingNav from "@/components/landing/LandingNav";

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="group relative flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]" : "bg-slate-300"}`} />
      <span className="hidden text-xs text-slate-500 sm:inline">{label}</span>
    </span>
  );
}

function startGoogle() {
  supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
}

export default function TopBar() {
  const token = useAccessToken();
  const [s, setS] = useState<StatusResponse | null>(null);
  useEffect(() => {
    apiStatus().then(setS).catch(() => setS(null));
  }, []);

  // Signed-out + Supabase configured → marketing nav. Otherwise the app/status bar.
  const showLanding = isSupabaseConfigured && token === null;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/70 backdrop-blur-md">
      {showLanding ? (
        <LandingNav onStart={startGoogle} />
      ) : (
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <Logo />
            <Badge tone="indigo">Beta</Badge>
          </div>
          {s && (
            <div className="flex items-center gap-4">
              <StatusDot ok={s.openrouter} label={s.fakeLlm ? "Stub LLM" : "LLM"} />
              <StatusDot ok={s.elevenlabs} label="Voice" />
              <StatusDot ok={s.supabase} label="Data" />
            </div>
          )}
        </div>
      )}
    </header>
  );
}
