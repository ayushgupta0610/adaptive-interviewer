import type { Guidelines, InterviewPlan, FeedbackReport, Transcript } from "@/domain/schemas";
import type { ChatMessage } from "@/core/chat";
import type { ConversationAnalysis } from "@/core/analysis";

export interface PrepareResponse {
  interviewId: string;
  plan: InterviewPlan;
  cached: boolean;
  fallback: boolean;
  systemPrompt: string;
  firstMessage: string;
  overrides: { agent: { prompt: { prompt: string }; firstMessage: string } };
}

export interface StatusResponse {
  openrouter: boolean;
  fakeLlm: boolean;
  elevenlabs: boolean;
  supabase: boolean;
  agentId: string | null;
  model: string;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const apiPrepare = (jd: string, guidelines: Guidelines) =>
  postJson<PrepareResponse>("/api/interview/prepare", { jd, guidelines });

export const apiTurn = (systemPrompt: string, messages: ChatMessage[]) =>
  postJson<{ reply: string }>("/api/interview/turn", { systemPrompt, messages });

export const apiScore = (plan: InterviewPlan, transcript: Transcript) =>
  postJson<{ report: FeedbackReport }>("/api/interview/score", { plan, transcript });

export const apiAnalysis = (conversationId: string) =>
  postJson<{ analysis: ConversationAnalysis }>("/api/interview/analysis", { conversationId });

export const apiStatus = () => fetch("/api/status").then((r) => r.json() as Promise<StatusResponse>);
