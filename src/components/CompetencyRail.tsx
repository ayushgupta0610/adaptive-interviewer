import type { InterviewPlan } from "@/domain/schemas";
import { Card } from "@/components/ui";

/** The "what we're assessing" rail — gives the interview a structured, product feel. */
export default function CompetencyRail({ plan }: { plan: InterviewPlan }) {
  return (
    <Card className="p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Assessing</h3>
      <ul className="space-y-2.5">
        {plan.competencies.map((c) => (
          <li key={c.id} className="flex items-start gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
            <span className="text-sm leading-snug text-slate-700">{c.label}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
