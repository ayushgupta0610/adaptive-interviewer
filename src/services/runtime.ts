import { env, hasOpenRouter, fakeLlmEnabled, hasSupabaseService } from "./env";
import { createOpenRouterClient, type LlmClient } from "./llm";
import { createFakeLlm } from "./fakeLlm";
import { createElevenLabsVoice, type VoiceProvider } from "./elevenlabs";
import { createMemoryPlanCache } from "./memoryCache";
import { createServiceClient, createSupabasePlanCache, createSupabaseRepo, type SupabaseRepo } from "./supabase";
import type { PlanCache } from "../usecases/ports";

/** Thrown when a route needs a service whose keys are not configured → mapped to HTTP 503. */
export class ServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceUnavailableError";
  }
}

export function getLlm(): LlmClient {
  if (fakeLlmEnabled) return createFakeLlm();
  if (!hasOpenRouter) {
    throw new ServiceUnavailableError("OPENROUTER_API_KEY is not set — add it to .env.local.");
  }
  return createOpenRouterClient({
    apiKey: env.OPENROUTER_API_KEY!,
    model: env.OPENROUTER_MODEL,
    title: "Adaptive Mock Interviewer",
  });
}

export const interviewModel = () => env.OPENROUTER_MODEL;

export function getVoice(): VoiceProvider {
  if (!env.ELEVENLABS_API_KEY) {
    throw new ServiceUnavailableError("ELEVENLABS_API_KEY is not set — add it to .env.local.");
  }
  return createElevenLabsVoice({ apiKey: env.ELEVENLABS_API_KEY });
}

// Persist the in-memory cache across requests in a single dev process.
let memoryCacheSingleton: PlanCache | null = null;

export function getPlanCache(): PlanCache {
  if (hasSupabaseService) return createSupabasePlanCache(createServiceClient());
  if (!memoryCacheSingleton) memoryCacheSingleton = createMemoryPlanCache();
  return memoryCacheSingleton;
}

export function getRepo(): SupabaseRepo {
  if (!hasSupabaseService) {
    throw new ServiceUnavailableError(
      "Supabase is not configured (need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  return createSupabaseRepo(createServiceClient());
}
