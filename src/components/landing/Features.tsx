import { GitBranch, Mic, Target } from "lucide-react";
import Reveal from "@/components/motion/Reveal";

const FEATURES = [
  { icon: GitBranch, title: "Truly adaptive", body: "Follow-ups are generated from your actual answers — not a fixed script." },
  { icon: Mic, title: "Voice-first realism", body: "Real-time speech with the pressure and pacing of an actual interview." },
  { icon: Target, title: "JD-tailored rubric", body: "Scored on the competencies that role actually screens for." },
];

export default function Features() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.08}>
            <div className="h-full rounded-2xl border border-hairline bg-white p-5">
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-indigo-600">
                <f.icon size={18} />
              </div>
              <h3 className="font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-[13px] leading-snug text-slate-500">{f.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
