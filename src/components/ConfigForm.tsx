"use client";

import { useState } from "react";
import type { Guidelines } from "@/domain/schemas";
import { apiPrepare, type PrepareResponse } from "@/lib/api";

export type Mode = "voice" | "text";

const TYPES: Guidelines["type"][] = ["behavioral", "technical", "system-design", "mixed"];
const SENIORITY: Guidelines["seniority"][] = ["intern", "junior", "mid", "senior", "staff+"];

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
  const [mode, setMode] = useState<Mode>(voiceAvailable ? "voice" : "text");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      onPrepared(prep, guidelines, mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to prepare interview");
    } finally {
      setLoading(false);
    }
  }

  const field = "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Job description</label>
        <textarea
          required
          minLength={20}
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          rows={8}
          placeholder="Paste the full job description…"
          className={field}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Interview type</label>
          <select value={type} onChange={(e) => setType(e.target.value as Guidelines["type"])} className={field}>
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Seniority</label>
          <select
            value={seniority}
            onChange={(e) => setSeniority(e.target.value as Guidelines["seniority"])}
            className={field}
          >
            {SENIORITY.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Number of questions</label>
          <input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className={field}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className={field}>
            <option value="voice" disabled={!voiceAvailable}>
              voice {voiceAvailable ? "" : "(needs ElevenLabs)"}
            </option>
            <option value="text">text</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Focus areas (comma-separated, optional)</label>
        <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. system design, ownership" className={field} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Preparing interview…" : "Prepare interview"}
      </button>
    </form>
  );
}
