import type { RoleSample } from "./samples";

const BAR_COLORS = ["bg-indigo-600", "bg-indigo-500", "bg-indigo-400"];

/** One sample scorecard: role · competency bars · strength + gap notes. */
export default function ScorecardCard({ sample }: { sample: RoleSample }) {
  return (
    <div className="flex flex-wrap gap-5 rounded-2xl border border-hairline bg-surface-muted p-5">
      <div className="min-w-[190px] flex-1">
        <div className="mb-3 text-sm font-bold text-slate-900">{sample.role}</div>
        <div className="flex flex-col gap-2.5">
          {sample.competencies.map((c, i) => (
            <div key={c.label}>
              <div className="mb-1 flex justify-between text-xs text-slate-600">
                <span>{c.label}</span>
                <span className="font-semibold text-indigo-600">{c.score.toFixed(1)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200">
                <div className={`h-1.5 rounded-full ${BAR_COLORS[i % 3]}`} style={{ width: `${(c.score / 5) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex min-w-[200px] flex-1 flex-col gap-2.5">
        <div className="rounded-xl border border-hairline bg-white p-3">
          <span className="mb-1.5 inline-block rounded-full bg-good-bg px-2 py-0.5 text-[11px] font-medium text-good">Strength</span>
          <p className="m-0 text-[13px] leading-snug text-slate-600">{sample.strength}</p>
        </div>
        <div className="rounded-xl border border-hairline bg-white p-3">
          <span className="mb-1.5 inline-block rounded-full bg-gap-bg px-2 py-0.5 text-[11px] font-medium text-gap">Gap</span>
          <p className="m-0 text-[13px] leading-snug text-slate-600">{sample.gap}</p>
        </div>
      </div>
    </div>
  );
}
