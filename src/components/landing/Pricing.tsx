"use client";
import { Check } from "lucide-react";
import { Button, cn } from "@/components/ui";
import Reveal from "@/components/motion/Reveal";
import { apiCheckout } from "@/lib/api";
import { TIERS } from "./pricing";

export default function Pricing({ onFree }: { onFree: () => void }) {
  async function choose(checkoutId?: "starter" | "pro") {
    if (!checkoutId) return onFree();
    const { url } = await apiCheckout(checkoutId);
    window.location.assign(url);
  }
  return (
    <section id="pricing" className="mx-auto w-full max-w-5xl px-6 py-14">
      <Reveal>
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">Simple, honest pricing</h2>
        <p className="mb-8 mt-1 text-center text-sm text-slate-500">Start free. Voice interviews cost us real money — so we price them fairly, not for free.</p>
      </Reveal>
      <div className="grid gap-4 sm:grid-cols-3">
        {TIERS.map((t, i) => (
          <Reveal key={t.id} delay={i * 0.07}>
            <div className={cn("flex h-full flex-col rounded-2xl border bg-white p-5", t.featured ? "border-2 border-indigo-600 shadow-lg shadow-indigo-600/10" : "border-hairline")}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">{t.name}</span>
                {t.featured && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">Popular</span>}
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {t.priceInr === 0 ? "₹0" : `₹${t.priceInr}`}<span className="text-[13px] font-medium text-slate-400">{t.priceInr === 0 ? "" : "/mo"}</span>
              </div>
              <p className="mt-0.5 text-[13px] text-slate-500">{t.blurb}</p>
              <ul className="my-4 flex flex-1 flex-col gap-2 text-[13px] text-slate-600">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2"><Check size={15} className="mt-0.5 shrink-0 text-indigo-600" />{f}</li>
                ))}
              </ul>
              <Button variant={t.featured ? "primary" : "secondary"} className="w-full" onClick={() => void choose(t.checkoutId)}>{t.cta}</Button>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
