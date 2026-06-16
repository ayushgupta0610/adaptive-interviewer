"use client";
import { Logo, Badge, Button } from "@/components/ui";

export default function LandingNav({ onStart }: { onStart: () => void }) {
  const scrollTo = (id: string) => () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  return (
    <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-6">
      <Logo />
      <Badge tone="indigo">Beta</Badge>
      <nav className="ml-auto flex items-center gap-4 text-sm font-medium text-slate-600">
        <button className="hidden hover:text-slate-900 sm:inline" onClick={scrollTo("how-it-works")}>How it works</button>
        <button className="hidden hover:text-slate-900 sm:inline" onClick={scrollTo("pricing")}>Pricing</button>
        <Button size="md" onClick={onStart}>Start free</Button>
      </nav>
    </div>
  );
}
