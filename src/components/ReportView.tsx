"use client";

import type { FeedbackReport, InterviewPlan } from "@/domain/schemas";
import { Button, Card, Badge, cn } from "@/components/ui";

function label(plan: InterviewPlan, competencyId: string): string {
  return plan.competencies.find((c) => c.id === competencyId)?.label ?? competencyId;
}

function scoreColor(score: number): string {
  if (score >= 4) return "bg-emerald-500";
  if (score >= 3) return "bg-amber-500";
  return "bg-rose-500";
}

function Meter({ score, max = 5 }: { score: number; max?: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={cn("h-1.5 w-6 rounded-full", i < Math.round(score) ? scoreColor(score) : "bg-slate-200")} />
      ))}
    </div>
  );
}

const REC: Record<FeedbackReport["recommendation"], { label: string; tone: "green" | "amber" | "rose" }> = {
  "strong-yes": { label: "Strong Yes", tone: "green" },
  yes: { label: "Yes", tone: "green" },
  "lean-yes": { label: "Lean Yes", tone: "green" },
  "lean-no": { label: "Lean No", tone: "amber" },
  no: { label: "No", tone: "rose" },
  "strong-no": { label: "Strong No", tone: "rose" },
};

export default function ReportView({
  report,
  plan,
  onRestart,
}: {
  report: FeedbackReport;
  plan: InterviewPlan;
  onRestart: () => void;
}) {
  const rec = REC[report.recommendation];
  const pct = Math.round((report.overall / 5) * 100);

  return (
    <div className="space-y-5">
      {/* Hero scorecard */}
      <Card className="overflow-hidden">
        <div className="flex flex-col items-center gap-6 p-7 sm:flex-row sm:items-center sm:gap-8">
          <div className="relative grid h-28 w-28 shrink-0 place-items-center">
            <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="9" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="url(#g)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * 264} 264`}
              />
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute text-center">
              <div className="text-2xl font-bold text-slate-900">{report.overall.toFixed(1)}</div>
              <div className="text-xs text-slate-400">/ 5.0</div>
            </div>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="mb-2 flex items-center justify-center gap-2 sm:justify-start">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">Feedback report</h2>
              <Badge tone={rec.tone}>{rec.label}</Badge>
            </div>
            <p className="text-pretty text-sm leading-relaxed text-slate-600">{report.summary}</p>
          </div>
        </div>
      </Card>

      {/* Per-competency */}
      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Competency breakdown</h3>
        <div className="space-y-4">
          {report.perCompetency.map((c) => (
            <div key={c.competencyId} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="font-medium text-slate-800">{label(plan, c.competencyId)}</span>
                <div className="flex items-center gap-2">
                  <Meter score={c.score} />
                  <span className="w-8 text-right text-sm font-semibold text-slate-700">{c.score}/5</span>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-slate-500">{c.evidence}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Strengths / Gaps */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <span className="grid h-5 w-5 place-items-center rounded-md bg-emerald-100 text-emerald-600">✓</span> Strengths
          </h3>
          <ul className="space-y-2 text-sm text-slate-600">
            {report.strengths.length ? report.strengths.map((s, i) => <li key={i} className="flex gap-2"><span className="text-emerald-500">•</span>{s}</li>) : <li className="text-slate-400">—</li>}
          </ul>
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-700">
            <span className="grid h-5 w-5 place-items-center rounded-md bg-amber-100 text-amber-600">!</span> Areas to improve
          </h3>
          <ul className="space-y-2 text-sm text-slate-600">
            {report.gaps.length ? report.gaps.map((s, i) => <li key={i} className="flex gap-2"><span className="text-amber-500">•</span>{s}</li>) : <li className="text-slate-400">—</li>}
          </ul>
        </Card>
      </div>

      <div className="flex justify-center pt-1">
        <Button variant="secondary" size="lg" onClick={onRestart}>Run another interview</Button>
      </div>
    </div>
  );
}
