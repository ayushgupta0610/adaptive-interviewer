"use client";
import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { supabaseBrowser, isSupabaseConfigured } from "@/lib/supabaseBrowser";
import { Card } from "@/components/ui";

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
      <Card className="p-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-indigo-600">
            <CreditCard size={16} />
          </span>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Account</h1>
        </div>
        <p className="text-sm text-slate-600">{info}</p>
      </Card>
    </main>
  );
}
