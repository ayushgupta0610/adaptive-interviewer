"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser, isSupabaseConfigured } from "@/lib/supabaseBrowser";

export default function Account() {
  const [info, setInfo] = useState<string>(
    isSupabaseConfigured ? "Loading…" : "No Supabase configured — running in keyless/demo mode.",
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabaseBrowser()
      .from("subscriptions")
      .select("plan_id,status,current_period_end")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) =>
        setInfo(
          data
            ? `${data.plan_id as string} · ${data.status as string} · renews ${(data.current_period_end as string | null) ?? "-"}`
            : "No active subscription",
        ),
      );
  }, []);

  return (
    <main className="mx-auto max-w-md p-10">
      <h1 className="mb-3 text-xl font-semibold">Account</h1>
      <p className="text-sm text-slate-600">{info}</p>
    </main>
  );
}
