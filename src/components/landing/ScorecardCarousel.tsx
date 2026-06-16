"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ROLE_SAMPLES } from "./samples";
import { nextIndex, prevIndex } from "./carousel";
import ScorecardCard from "./ScorecardCard";
import { cn } from "@/components/ui";

/** Role pills + a single-card slider with arrows + dots. */
export default function ScorecardCarousel() {
  const [i, setI] = useState(0);
  const len = ROLE_SAMPLES.length;
  const active = ROLE_SAMPLES[i];
  return (
    <div className="rounded-2xl border border-hairline bg-white p-6 shadow-sm shadow-slate-200/50">
      <h3 className="text-2xl font-bold tracking-tight text-slate-900">See exactly where you stand — for any role</h3>
      <p className="mb-4 mt-1 text-sm text-slate-500">Every interview ends in a recruiter-grade report. Pick a role to see a sample.</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {ROLE_SAMPLES.map((r, idx) => (
          <button
            key={r.id}
            onClick={() => setI(idx)}
            aria-pressed={idx === i}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              idx === i ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            )}
          >
            {r.role.split(" · ")[0]}
          </button>
        ))}
      </div>

      <ScorecardCard sample={active} />

      <div className="mt-4 flex items-center justify-center gap-3.5">
        <button onClick={() => setI((c) => prevIndex(c, len))} aria-label="Previous role"
          className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40">
          <ChevronLeft size={16} />
        </button>
        <div className="flex gap-1.5">
          {ROLE_SAMPLES.map((r, idx) => (
            <span key={r.id} className={cn("h-1.5 rounded-full transition-all", idx === i ? "w-5 bg-indigo-600" : "w-1.5 bg-slate-300")} />
          ))}
        </div>
        <button onClick={() => setI((c) => nextIndex(c, len))} aria-label="Next role"
          className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
