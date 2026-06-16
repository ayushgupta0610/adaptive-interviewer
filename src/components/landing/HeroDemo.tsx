"use client";
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

const PROMPTS = [
  "Walk me through a system you designed for scale.",
  "You mentioned sharding — how did you rebalance without downtime?",
  "What failure modes worried you, and how did you mitigate them?",
];
const BARS = [40, 75, 100, 55, 88, 35, 64, 48];

export default function HeroDemo() {
  const reduce = useReducedMotion();
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % PROMPTS.length), 3200);
    return () => clearInterval(t);
  }, [reduce]);

  return (
    <div className="rounded-2xl border border-hairline bg-white p-4 shadow-xl shadow-slate-300/30">
      <div className="mb-2.5 flex items-center gap-2 text-xs text-slate-400">
        <span className="h-2 w-2 rounded-full bg-rose-400" />
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="ml-auto">● Live · 04:12</span>
      </div>
      <div className="text-xs font-semibold text-indigo-600">Interviewer</div>
      <p className="mb-1 mt-1 min-h-[40px] text-[13px] leading-snug text-slate-700">{PROMPTS[idx]}</p>
      <div className="my-2.5 flex h-[34px] items-end gap-[3px]">
        {BARS.map((h, i) => (
          <span
            key={i}
            className="w-1 rounded-full bg-indigo-400"
            style={{
              height: `${h}%`,
              animation: reduce ? undefined : `pulse-bar 1.1s ease-in-out ${i * 0.08}s infinite alternate`,
            }}
          />
        ))}
      </div>
      <div className="border-t border-slate-100 pt-2 text-[11px] text-slate-400">↳ adapts to your last answer · follow-up auto-generated</div>
    </div>
  );
}
