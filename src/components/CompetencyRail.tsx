import type { InterviewPlan } from "@/domain/schemas";
import { Card } from "@/components/ui";
import { Target, Check } from "lucide-react";

/** The "what we're assessing" rail — gives the interview a structured, product feel. */
export default function CompetencyRail({ plan }: { plan: InterviewPlan }) {
  return (
    <Card className="p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400"><span className="inline-flex items-center gap-1.5"><Target size={13} /> Assessing</span></h3>
      <ul className="space-y-2.5">
        {plan.competencies.map((c) => (
          <li key={c.id} className="flex items-start gap-2.5">
            <Check size={14} className="mt-0.5 shrink-0 text-indigo-500" />
            <span className="text-sm leading-snug text-slate-700">{c.label}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
