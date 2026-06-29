"use client";
import { Button } from "@/components/ui";
import Reveal from "@/components/motion/Reveal";
import HeroDemo from "./HeroDemo";

export default function Hero({ onStart }: { onStart: () => void }) {
  return (
    <section className="mx-auto grid w-full max-w-5xl items-center gap-9 px-6 py-16 md:grid-cols-[1.1fr_1fr]">
      <Reveal>
        <div>
          <span className="mb-4 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            ⚡ Voice-first AI mock interviews
          </span>
          <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl">
            Practice the interview <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">before it counts.</span>
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-lg text-slate-500">
            Paste any job description. A voice AI runs a real mock interview, adapts to your answers in real time, and scores you like a hiring panel would.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" onClick={onStart}>Start your free interview →</Button>
            <Button size="lg" variant="secondary" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>
              See how it works
            </Button>
          </div>
          <p className="mt-3.5 text-xs text-slate-400">Your first voice interview is free · No credit card · ~10 min</p>
        </div>
      </Reveal>
      <Reveal delay={0.1}>
        <HeroDemo />
      </Reveal>
    </section>
  );
}
