"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser, isSupabaseConfigured } from "@/lib/supabaseBrowser";
import { gateView } from "@/components/landing/auth-view";
import Landing from "@/components/landing/Landing";

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
 * Signed-out visitors (Supabase configured, no token) see the marketing Landing.
 * Signed-in users and keyless/demo mode get the app directly.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const token = useAccessToken();
  if (gateView(isSupabaseConfigured, token) === "app") return <>{children}</>;
  return <Landing />;
}
