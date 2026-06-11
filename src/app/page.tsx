"use client";

import { useEffect, useState } from "react";
import type { FeedbackReport, Guidelines, InterviewPlan, Transcript } from "@/domain/schemas";
import { apiScore, apiStatus, type PrepareResponse } from "@/lib/api";
import ConfigForm, { type Mode } from "@/components/ConfigForm";
import TextInterview from "@/components/TextInterview";
import VoiceInterview from "@/components/VoiceInterview";
import ReportView from "@/components/ReportView";
import { Card, Spinner } from "@/components/ui";

type Step = "config" | "interview" | "scoring" | "report";

const STEPS: { key: Step; label: string }[] = [
  { key: "config", label: "Configure" },
  { key: "interview", label: "Interview" },
  { key: "report", label: "Feedback" },
];

function Stepper({ current }: { current: Step }) {
  const idx = current === "scoring" ? 1 : STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold transition-colors ${
                i <= idx ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"
              }`}
            >
              {i + 1}
            </span>
            <span className={`text-sm font-medium ${i <= idx ? "text-slate-900" : "text-slate-400"}`}>{s.label}</span>
          </div>
          {i < STEPS.length - 1 && <span className={`h-px w-8 ${i < idx ? "bg-indigo-300" : "bg-slate-200"}`} />}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [step, setStep] = useState<Step>("config");
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [simliEnabled, setSimliEnabled] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [prep, setPrep] = useState<PrepareResponse | null>(null);
  const [plan, setPlan] = useState<InterviewPlan | null>(null);
  const [mode, setMode] = useState<Mode>("text");
  const [report, setReport] = useState<FeedbackReport | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiStatus()
      .then((s) => {
        setVoiceAvailable(s.elevenlabs);
        setSimliEnabled(s.simli);
        setAgentId(s.agentId);
      })
      .catch(() => undefined);
  }, []);

  function onPrepared(p: PrepareResponse, _g: Guidelines, m: Mode) {
    setPrep(p);
    setPlan(p.plan);
    setMode(m);
    setReport(null);
    setError(null);
    setStep("interview");
  }

  async function onComplete(transcript: Transcript, convId?: string) {
    if (!plan) return;
    setConversationId(convId ?? null);
    setStep("scoring");
    setError(null);
    try {
      const { report: r } = await apiScore(plan, transcript);
      setReport(r);
      setStep("report");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scoring failed");
      setStep("interview");
    }
  }

  function restart() {
    setStep("config");
    setPrep(null);
    setPlan(null);
    setReport(null);
    setConversationId(null);
    setError(null);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 sm:py-14">
      {step !== "config" && (
        <div className="mb-8">
          <Stepper current={step} />
        </div>
      )}

      {error && (
        <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {step === "config" && (
        <div className="animate-rise">
          <div className="mb-8 text-center">
            <h1 className="text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Practice the interview <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">before it counts</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-lg text-slate-500">
              Paste any job description. Get a voice-first AI interviewer that adapts to your answers and scores you like a real panel.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm text-slate-500">
              {["Voice or text", "Adaptive follow-ups", "Scored feedback in seconds"].map((f) => (
                <span key={f} className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 ring-1 ring-slate-200">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="m5 13 4 4L19 7" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {f}
                </span>
              ))}
            </div>
          </div>
          <Card className="p-6 sm:p-8">
            <ConfigForm voiceAvailable={voiceAvailable} onPrepared={onPrepared} />
          </Card>
        </div>
      )}

      {step === "interview" && prep && plan && (
        <section className="animate-rise space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">{plan.role}</h2>
              <p className="text-sm text-slate-500">
                {plan.competencies.length} competencies · {mode === "voice" ? "voice" : "text"} interview
                {prep.cached ? " · cached plan" : ""}
                {prep.fallback ? " · generic fallback plan" : ""}
              </p>
            </div>
          </div>
          {mode === "voice" && agentId ? (
            <VoiceInterview agentId={agentId} overrides={prep.overrides} plan={plan} simliEnabled={simliEnabled} onComplete={onComplete} />
          ) : (
            <TextInterview interviewId={prep.interviewId} firstMessage={prep.firstMessage} plan={plan} onComplete={onComplete} />
          )}
        </section>
      )}

      {step === "scoring" && (
        <Card className="animate-fade-in flex flex-col items-center gap-3 p-12 text-center">
          <Spinner className="h-6 w-6 text-indigo-600" />
          <p className="font-medium text-slate-700">Scoring your interview…</p>
          <p className="text-sm text-slate-400">Grading each competency against the rubric.</p>
        </Card>
      )}

      {step === "report" && report && plan && (
        <div className="animate-rise">
          <ReportView report={report} plan={plan} conversationId={conversationId ?? undefined} onRestart={restart} />
        </div>
      )}
    </main>
  );
}
