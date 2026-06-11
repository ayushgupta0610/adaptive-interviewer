import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { InterviewPlan, FeedbackReport, Transcript, Guidelines } from "../domain/schemas";
import type { PlanCache } from "../usecases/ports";
import { env } from "./env";

/** Server-only client using the service role (bypasses RLS). Never expose to the browser. */
export function createServiceClient(): SupabaseClient {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service client requested but URL/service-role key are not set");
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** PlanCache backed by the shared `interviews` table. */
export function createSupabasePlanCache(client: SupabaseClient): PlanCache {
  return {
    async get(configHash) {
      const { data, error } = await client
        .from("interviews")
        .select("id, plan")
        .eq("config_hash", configHash)
        .maybeSingle();
      if (error) throw new Error(`interviews lookup failed: ${error.message}`);
      if (!data) return null;
      return { interviewId: data.id as string, plan: data.plan as InterviewPlan };
    },
    async put({ configHash, jd, guidelines, plan }) {
      const { data, error } = await client
        .from("interviews")
        .insert({ config_hash: configHash, jd_text: jd, guidelines, plan })
        .select("id")
        .single();
      if (error) throw new Error(`interviews insert failed: ${error.message}`);
      return data.id as string;
    },
    async getById(interviewId) {
      const { data, error } = await client
        .from("interviews")
        .select("plan, guidelines")
        .eq("id", interviewId)
        .maybeSingle();
      if (error) throw new Error(`interview lookup failed: ${error.message}`);
      if (!data) return null;
      return { plan: data.plan as InterviewPlan, guidelines: data.guidelines as Guidelines };
    },
  };
}

/** Minimal session/feedback persistence used by the routes (service role). */
export function createSupabaseRepo(client: SupabaseClient) {
  return {
    async ensureCandidate(candidateId: string): Promise<void> {
      const { error } = await client.from("candidates").upsert({ id: candidateId }, { onConflict: "id" });
      if (error) throw new Error(`candidate upsert failed: ${error.message}`);
    },
    async createSession(input: { interviewId: string; candidateId: string }): Promise<string> {
      const { data, error } = await client
        .from("sessions")
        .insert({ interview_id: input.interviewId, candidate_id: input.candidateId, status: "created" })
        .select("id")
        .single();
      if (error) throw new Error(`session insert failed: ${error.message}`);
      return data.id as string;
    },
    async attachConversation(sessionId: string, elConversationId: string): Promise<void> {
      const { error } = await client
        .from("sessions")
        .update({ el_conversation_id: elConversationId, status: "in_progress", started_at: new Date().toISOString() })
        .eq("id", sessionId);
      if (error) throw new Error(`session update failed: ${error.message}`);
    },
    async completeSession(sessionId: string, transcript: Transcript, recordingUrl?: string): Promise<void> {
      const { error } = await client
        .from("sessions")
        .update({
          transcript,
          recording_url: recordingUrl ?? null,
          status: "completed",
          ended_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
      if (error) throw new Error(`session complete failed: ${error.message}`);
    },
    async getSession(sessionId: string): Promise<{ interviewId: string; transcript: Transcript | null } | null> {
      const { data, error } = await client
        .from("sessions")
        .select("interview_id, transcript")
        .eq("id", sessionId)
        .maybeSingle();
      if (error) throw new Error(`session lookup failed: ${error.message}`);
      if (!data) return null;
      return { interviewId: data.interview_id as string, transcript: (data.transcript as Transcript) ?? null };
    },
    async getPlanForInterview(interviewId: string): Promise<InterviewPlan | null> {
      const { data, error } = await client.from("interviews").select("plan").eq("id", interviewId).maybeSingle();
      if (error) throw new Error(`plan lookup failed: ${error.message}`);
      return data ? (data.plan as InterviewPlan) : null;
    },
    async saveFeedback(sessionId: string, report: FeedbackReport): Promise<string> {
      const { data, error } = await client
        .from("feedback")
        .insert({ session_id: sessionId, report })
        .select("id")
        .single();
      if (error) throw new Error(`feedback insert failed: ${error.message}`);
      return data.id as string;
    },
  };
}

export type SupabaseRepo = ReturnType<typeof createSupabaseRepo>;
