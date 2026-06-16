import Reveal from "@/components/motion/Reveal";

const STEPS = [
  { n: 1, title: "Paste the job description", body: "Any role, any seniority. We build a tailored competency rubric from it." },
  { n: 2, title: "Get interviewed by voice", body: "A realtime AI interviewer asks, listens, and digs deeper based on your answers." },
  { n: 3, title: "Get scored like a panel", body: "A rubric-based scorecard with strengths, gaps, and exactly what to fix." },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.08}>
            <div className="h-full rounded-2xl border border-hairline bg-white p-5">
              <div className="mb-2.5 grid h-7 w-7 place-items-center rounded-full bg-indigo-600 text-sm font-semibold text-white">{s.n}</div>
              <h3 className="font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-1 text-[13px] leading-snug text-slate-500">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
