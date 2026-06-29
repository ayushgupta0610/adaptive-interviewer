"use client";

import { useState } from "react";
import { Mic, MessageSquare, ArrowRight, ChevronDown } from "lucide-react";
import type { Guidelines } from "@/domain/schemas";
import { apiPrepare, type PrepareResponse } from "@/lib/api";
import { Button, Spinner, cn } from "@/components/ui";

export type Mode = "voice" | "text";

const TYPES: Guidelines["type"][] = ["behavioral", "technical", "system-design", "mixed"];
const SENIORITY: Guidelines["seniority"][] = ["intern", "junior", "mid", "senior", "staff+"];

const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";
const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputClass, "appearance-none pr-9 capitalize")}>
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

export default function ConfigForm({
  voiceAvailable,
  onPrepared,
}: {
  voiceAvailable: boolean;
  onPrepared: (prep: PrepareResponse, guidelines: Guidelines, mode: Mode) => void;
}) {
  const [jd, setJd] = useState("");
  const [type, setType] = useState<Guidelines["type"]>("mixed");
  const [seniority, setSeniority] = useState<Guidelines["seniority"]>("mid");
  const [count, setCount] = useState(5);
  const [focus, setFocus] = useState("");
  const [mode, setMode] = useState<Mode>("voice");
  const [userPickedMode, setUserPickedMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived (no effect): default to voice once status confirms it's available,
  // unless the user has explicitly picked a mode.
  const effectiveMode: Mode = userPickedMode ? mode : voiceAvailable ? "voice" : "text";

  function pickMode(m: Mode) {
    setUserPickedMode(true);
    setMode(m);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const guidelines: Guidelines = {
      type,
      seniority,
      budget: { kind: "questions", count },
      focusAreas: focus.split(",").map((s) => s.trim()).filter(Boolean),
    };
    try {
      const prep = await apiPrepare(jd, guidelines);
      onPrepared(prep, guidelines, effectiveMode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to prepare interview");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className={labelClass}>Job description</label>
        <textarea
          required
          minLength={20}
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          rows={7}
          placeholder="Paste the full job description — role, responsibilities, must-have skills…"
          className={cn(inputClass, "resize-y leading-relaxed")}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Interview type</label>
          <Select value={type} onChange={(v) => setType(v as Guidelines["type"])}>
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className={labelClass}>Seniority</label>
          <Select value={seniority} onChange={(v) => setSeniority(v as Guidelines["seniority"])}>
            {SENIORITY.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className={labelClass}>Number of questions</label>
          <input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Mode</label>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-300 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => voiceAvailable && pickMode("voice")}
              disabled={!voiceAvailable}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium transition-all",
                effectiveMode === "voice" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
                !voiceAvailable && "cursor-not-allowed opacity-50",
              )}
            >
              <Mic size={15} /> Voice
            </button>
            <button
              type="button"
              onClick={() => pickMode("text")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium transition-all",
                effectiveMode === "text" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
              )}
            >
              <MessageSquare size={15} /> Text
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass}>Focus areas <span className="font-normal text-slate-400">(comma-separated, optional)</span></label>
        <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. system design, ownership, communication" className={inputClass} />
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <Button type="submit" size="lg" disabled={loading} className="w-full sm:w-auto">
        {loading ? (
          <>
            <Spinner /> Preparing your interview…
          </>
        ) : (
          <>
            Start interview
            <ArrowRight size={16} />
          </>
        )}
      </Button>
    </form>
  );
}
