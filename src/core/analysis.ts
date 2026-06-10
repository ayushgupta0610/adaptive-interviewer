/** Normalized ElevenLabs post-call analysis (the "recruiter view"). */
export interface AnalysisCriterion {
  id: string;
  result: string; // "success" | "failure" | "unknown"
  rationale: string;
}

export interface AnalysisDatum {
  key: string;
  value: unknown;
  rationale?: string;
}

export interface ConversationAnalysis {
  ready: boolean;
  status: string;
  summary: string;
  title?: string;
  criteria: AnalysisCriterion[];
  data: AnalysisDatum[];
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

/**
 * Normalize the ElevenLabs `GET /conversations/{id}` payload into our recruiter-view
 * shape. Tolerant of missing fields; `ready` is true once the call is processed and
 * has produced criteria or data.
 */
export function normalizeAnalysis(raw: unknown): ConversationAnalysis {
  const root = asRecord(raw);
  const status = typeof root.status === "string" ? root.status : "unknown";
  const a = asRecord(root.analysis);

  const criteria: AnalysisCriterion[] = Object.entries(asRecord(a.evaluation_criteria_results)).map(
    ([id, v]) => {
      const r = asRecord(v);
      return { id, result: String(r.result ?? "unknown"), rationale: String(r.rationale ?? "") };
    },
  );

  const data: AnalysisDatum[] = Object.entries(asRecord(a.data_collection_results)).map(([key, v]) => {
    const r = asRecord(v);
    return {
      key,
      value: "value" in r ? r.value : null,
      rationale: r.rationale ? String(r.rationale) : undefined,
    };
  });

  const ready = status === "done" && (criteria.length > 0 || data.length > 0);
  return {
    ready,
    status,
    summary: String(a.transcript_summary ?? ""),
    title: a.call_summary_title ? String(a.call_summary_title) : undefined,
    criteria,
    data,
  };
}
