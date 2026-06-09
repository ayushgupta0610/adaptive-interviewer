"use client";

import type { FeedbackReport, InterviewPlan } from "@/domain/schemas";

function label(plan: InterviewPlan, competencyId: string): string {
  return plan.competencies.find((c) => c.id === competencyId)?.label ?? competencyId;
}

export default function ReportView({
  report,
  plan,
  onRestart,
}: {
  report: FeedbackReport;
  plan: InterviewPlan;
  onRestart: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Feedback report</h2>
        <div className="text-right">
          <div className="text-3xl font-bold">{report.overall.toFixed(1)}/5</div>
          <div className="text-sm uppercase tracking-wide text-zinc-500">{report.recommendation.replace("-", " ")}</div>
        </div>
      </div>

      <p className="text-zinc-700">{report.summary}</p>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">Per competency</h3>
        <div className="space-y-2">
          {report.perCompetency.map((c) => (
            <div key={c.competencyId} className="rounded-lg border border-zinc-200 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{label(plan, c.competencyId)}</span>
                <span className="font-semibold">{c.score}/5</span>
              </div>
              <p className="mt-1 text-sm text-zinc-600">{c.evidence}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-green-700">Strengths</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
            {report.strengths.length ? report.strengths.map((s, i) => <li key={i}>{s}</li>) : <li className="text-zinc-400">—</li>}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-700">Gaps</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
            {report.gaps.length ? report.gaps.map((s, i) => <li key={i}>{s}</li>) : <li className="text-zinc-400">—</li>}
          </ul>
        </div>
      </div>

      <button onClick={onRestart} className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium">
        New interview
      </button>
    </div>
  );
}
