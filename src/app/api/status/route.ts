import { hasOpenRouter, hasElevenLabs, hasSupabaseService, env } from "@/services/env";

/** Reports which services are configured so the UI can degrade gracefully. */
export async function GET() {
  return Response.json({
    openrouter: hasOpenRouter,
    elevenlabs: hasElevenLabs,
    supabase: hasSupabaseService,
    agentId: env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? null,
    model: env.OPENROUTER_MODEL,
  });
}
