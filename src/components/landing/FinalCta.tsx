"use client";
import { Button } from "@/components/ui";
import Reveal from "@/components/motion/Reveal";

export default function FinalCta({ onStart }: { onStart: () => void }) {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pb-16">
      <Reveal>
        <div className="rounded-2xl bg-gradient-to-b from-surface-muted to-brand-50 px-6 py-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Walk in ready.</h2>
          <p className="mb-5 mt-1 text-sm text-slate-500">Your first voice interview is on us.</p>
          <Button size="lg" onClick={onStart}>Continue with Google →</Button>
        </div>
      </Reveal>
    </section>
  );
}
