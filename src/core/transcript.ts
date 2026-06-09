import type { Transcript } from "../domain/schemas";

const INTERVIEWER_ROLES = new Set(["agent", "ai", "assistant", "interviewer", "bot"]);
const CANDIDATE_ROLES = new Set(["user", "human", "candidate"]);

/**
 * Normalize a raw provider transcript (ElevenLabs `GET /conversations/{id}` or a
 * post-call webhook) into our canonical role/text turns. Deliberately tolerant of
 * the exact field names since the provider shape is confirmed only at integration:
 * accepts `message` | `text` | `content`, and several role aliases.
 */
export function normalizeTranscript(raw: unknown): Transcript {
  if (!Array.isArray(raw)) return [];
  const out: Transcript = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const role = typeof e.role === "string" ? e.role.toLowerCase() : "";
    const text = String(e.message ?? e.text ?? e.content ?? "").trim();
    if (!text) continue;
    if (INTERVIEWER_ROLES.has(role)) out.push({ role: "interviewer", text });
    else if (CANDIDATE_ROLES.has(role)) out.push({ role: "candidate", text });
  }
  return out;
}

/** Render a transcript as labelled lines for embedding in a scoring prompt. */
export function formatTranscript(t: Transcript): string {
  return t
    .map((turn) => `${turn.role === "interviewer" ? "Interviewer" : "Candidate"}: ${turn.text}`)
    .join("\n");
}
