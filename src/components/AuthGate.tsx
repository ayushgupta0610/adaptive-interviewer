"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser, isSupabaseConfigured } from "@/lib/supabaseBrowser";
import { Button, Card } from "@/components/ui";

/**
 * Returns the current Supabase access token, or null when not signed in.
 * When Supabase is not configured (keyless/demo mode) always returns a
 * sentinel string so callers treat the user as "authenticated" locally.
 */
export function useAccessToken(): string | null {
  const [token, setToken] = useState<string | null>(() =>
    isSupabaseConfigured ? null : "demo",
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = supabaseBrowser();
    sb.auth
      .getSession()
      .then(({ data }) => setToken(data.session?.access_token ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) =>
      setToken(s?.access_token ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  return token;
}

/**
 * Wraps children with a Google OAuth sign-in gate.
 *
 * When NEXT_PUBLIC_SUPABASE_URL is NOT set (keyless/demo mode), renders
 * children directly without requiring a sign-in — preserving the demo flow.
 * When Supabase IS configured, shows a "Continue with Google" prompt until
 * the user is authenticated.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const token = useAccessToken();

  // Keyless mode: token is "demo" immediately; skip the sign-in wall.
  if (!isSupabaseConfigured) return <>{children}</>;

  if (token) return <>{children}</>;

  return (
    <Card className="mx-auto max-w-sm p-8 text-center">
      <h2 className="mb-2 text-lg font-semibold">Sign in to start</h2>
      <p className="mb-4 text-sm text-slate-500">Your first voice interview is free.</p>
      <Button
        onClick={() =>
          supabaseBrowser().auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: window.location.origin },
          })
        }
      >
        Continue with Google
      </Button>
    </Card>
  );
}
