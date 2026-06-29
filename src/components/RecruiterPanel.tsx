"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X, CircleHelp, ClipboardCheck } from "lucide-react";
import { apiAnalysis } from "@/lib/api";
import type { ConversationAnalysis } from "@/core/analysis";
import { Card, Badge, Spinner } from "@/components/ui";
import Reveal from "@/components/motion/Reveal";

const MAX_TRIES = 12; // ~60s of polling at 5s

function prettify(s: string): string {
  return s.replace(/[_-]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function tone(result: string): "green" | "rose" | "slate" {
  if (result === "success") return "green";
  if (result === "failure") return "rose";
  return "slate";
}

function resultLabel(result: string): string {
  if (result === "success") return "Pass";
  if (result === "failure") return "Fail";
  return "Unclear";
}

/**
 * Recruiter view — the ElevenLabs agent's independent post-call analysis (eval
 * criteria + extracted fields). Voice interviews only; computed asynchronously, so
 * we poll until it's ready.
 */
export default function RecruiterPanel({ conversationId }: { conversationId: string }) {
  const [analysis, setAnalysis] = useState<ConversationAnalysis | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tries = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const { analysis: a } = await apiAnalysis(conversationId);
        if (cancelled) return;
        setAnalysis(a);
        if (a.ready || tries.current >= MAX_TRIES) {
          setDone(true);
          return;
        }
      } catch (e) {
        if (cancelled) return;
        if (tries.current >= MAX_TRIES) {
          setError(e instanceof Error ? e.message : "Failed to load analysis");
          setDone(true);
          return;
        }
      }
      tries.current += 1;
      timer = setTimeout(poll, 5000);
    }
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [conversationId]);

  const ready = analysis?.ready;

  return (
    <Card className="p-6">
      <div className="mb-1 flex items-center gap-2">
        <ClipboardCheck size={15} className="text-indigo-600" />
        <h3 className="text-sm font-semibold text-slate-900">Recruiter view</h3>
        <Badge tone="indigo">AI call analysis</Badge>
      </div>
      <p className="mb-4 text-xs text-slate-400">The interviewer&apos;s independent evaluation of the call.</p>

      {!ready && !done && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner className="h-4 w-4 text-indigo-600" /> Generating the recruiter analysis…
        </div>
      )}

      {done && !ready && (
        <p className="text-sm text-slate-500">
          {error ?? "Analysis is still processing — it will appear in the ElevenLabs dashboard shortly."}
        </p>
      )}

      {ready && analysis && (
        <Reveal>
          <div className="space-y-5">
            {analysis.data.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {analysis.data.map((d) => (
                  <div key={d.key} className="rounded-xl border border-hairline bg-surface-muted p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{prettify(d.key)}</div>
                    <div className="mt-0.5 text-sm text-slate-800">
                      {d.value === null || d.value === "" ? "—" : String(d.value)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {analysis.criteria.length > 0 && (
              <div className="space-y-2.5">
                {analysis.criteria.map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{prettify(c.id)}</div>
                      {c.rationale && <div className="text-xs text-slate-500">{c.rationale}</div>}
                    </div>
                    <Badge tone={tone(c.result)}>
                      {c.result === "success" ? <Check size={12} /> : c.result === "failure" ? <X size={12} /> : <CircleHelp size={12} />}
                      {resultLabel(c.result)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {analysis.summary && (
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Call summary</div>
                <p className="text-sm leading-relaxed text-slate-600">{analysis.summary}</p>
              </div>
            )}
          </div>
        </Reveal>
      )}
    </Card>
  );
}
