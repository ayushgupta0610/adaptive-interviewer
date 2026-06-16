import { createClient } from "@supabase/supabase-js";
import { env, hasSupabaseClient, hasSupabaseService } from "./env";

/**
 * Extract + verify the Supabase access token from the Authorization header → user id.
 *
 * When Supabase is NOT configured (keyless local/demo mode), returns "anonymous" so
 * routes bypass auth entirely and the demo flow is unblocked.
 * When Supabase IS configured, verifies the JWT and returns the real uid or null.
 */
export async function getUserId(request: Request): Promise<string | null> {
  if (!hasSupabaseClient && !hasSupabaseService) return "anonymous";
  const auth = request.headers.get("authorization");
  const token = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

/** 401 helper. */
export function unauthorized(): Response {
  return Response.json({ error: "Sign in required." }, { status: 401 });
}
