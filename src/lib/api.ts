import type { Guidelines, InterviewPlan, FeedbackReport, Transcript } from "@/domain/schemas";
import type { ChatMessage } from "@/core/chat";
import type { ConversationAnalysis } from "@/core/analysis";
import { supabaseBrowser, isSupabaseConfigured } from "@/lib/supabaseBrowser";

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
  simli: boolean;
  agentId: string | null;
  model: string;
}

export interface SimliSession {
  sessionToken: string;
  iceServers: RTCIceServer[] | null;
}

/** Returns an Authorization header when a Supabase session exists, else empty. */
async function authHeader(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured) return {};
  const { data } = await supabaseBrowser().auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

/**
 * POST a JSON body and return the parsed response.
 *
 * HTTP 402 is treated as a normal (non-throwing) payload so the caller can
 * inspect `{ allowed: false, reason }` and render the paywall.
 * All other non-ok statuses throw an Error.
 */
async function postJson<T>(url: string, body: unknown): Promise<T> {
  const extra = await authHeader();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extra },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  // 402 is a structured payload (allowed:false), not an error.
  if (res.status === 402) return data as T;
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const apiPrepare = (jd: string, guidelines: Guidelines) =>
  postJson<PrepareResponse>("/api/interview/prepare", { jd, guidelines });

export const apiTurn = (interviewId: string, messages: ChatMessage[]) =>
  postJson<{ reply: string }>("/api/interview/turn", { interviewId, messages });

export const apiScore = (plan: InterviewPlan, transcript: Transcript) =>
  postJson<{ report: FeedbackReport }>("/api/interview/score", { plan, transcript });

export const apiAnalysis = (conversationId: string) =>
  postJson<{ analysis: ConversationAnalysis }>("/api/interview/analysis", { conversationId });

export const apiSimliSession = () => postJson<SimliSession>("/api/simli/session", {});

export const apiStatus = () => fetch("/api/status").then((r) => r.json() as Promise<StatusResponse>);

/** Initiate a Cashfree subscription checkout; returns { url } to redirect to. */
export const apiCheckout = (planId: "starter" | "pro") =>
  postJson<{ url: string }>("/api/billing/checkout", { planId });

/**
 * Gate call before starting an interview.
 * Returns { allowed: true, billedAs } or { allowed: false, reason }.
 * HTTP 402 from the server is returned as a normal object (not thrown).
 */
export const apiSessionStart = (mode: "text" | "voice") =>
  postJson<{ allowed: boolean; reason?: string; billedAs?: string }>("/api/session/start", { mode });
