import { z } from "zod";

/**
 * Server-side env. Everything is optional so the app boots without keys; callers
 * check the `has*` flags and return a clear 503 when a needed service is missing.
 */
const EnvSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_MODEL: z.string().min(1).default("anthropic/claude-haiku-4.5"),
  // Deterministic stub LLM for keyless local dev / offline demo / E2E.
  FAKE_LLM: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_ELEVENLABS_AGENT_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  // Simli avatar (optional, experimental). Both required to enable the face.
  SIMLI_API_KEY: z.string().min(1).optional(),
  SIMLI_FACE_ID: z.string().min(1).optional(),
});

export const env = EnvSchema.parse({
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
  FAKE_LLM: process.env.FAKE_LLM,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  NEXT_PUBLIC_ELEVENLABS_AGENT_ID: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SIMLI_API_KEY: process.env.SIMLI_API_KEY,
  SIMLI_FACE_ID: process.env.SIMLI_FACE_ID,
});

export const fakeLlmEnabled = env.FAKE_LLM === "1";
export const hasOpenRouter = !!env.OPENROUTER_API_KEY;
/** True when an LLM is callable — either real OpenRouter or the stub. */
export const hasLlm = hasOpenRouter || fakeLlmEnabled;
export const hasElevenLabs = !!env.ELEVENLABS_API_KEY && !!env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
export const hasSupabaseClient = !!env.NEXT_PUBLIC_SUPABASE_URL && !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const hasSupabaseService = !!env.NEXT_PUBLIC_SUPABASE_URL && !!env.SUPABASE_SERVICE_ROLE_KEY;
export const hasSimli = !!env.SIMLI_API_KEY && !!env.SIMLI_FACE_ID;
