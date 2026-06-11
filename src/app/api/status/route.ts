import { hasLlm, hasElevenLabs, hasSupabaseService, hasSimli, fakeLlmEnabled, env } from "@/services/env";

/** Reports which services are configured so the UI can degrade gracefully. */
export async function GET() {
  return Response.json({
    openrouter: hasLlm,
    fakeLlm: fakeLlmEnabled,
    elevenlabs: hasElevenLabs,
    supabase: hasSupabaseService,
    simli: hasSimli,
    agentId: env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? null,
    model: fakeLlmEnabled ? "stub-llm" : env.OPENROUTER_MODEL,
  });
}
