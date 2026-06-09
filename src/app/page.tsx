"use client";

import { useEffect, useState } from "react";
import type { FeedbackReport, Guidelines, InterviewPlan, Transcript } from "@/domain/schemas";
import { apiScore, apiStatus, type PrepareResponse } from "@/lib/api";
import StatusBanner from "@/components/StatusBanner";
import ConfigForm, { type Mode } from "@/components/ConfigForm";
import TextInterview from "@/components/TextInterview";
import VoiceInterview from "@/components/VoiceInterview";
import ReportView from "@/components/ReportView";

type Step = "config" | "interview" | "scoring" | "report";

export default function Home() {
  const [step, setStep] = useState<Step>("config");
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [prep, setPrep] = useState<PrepareResponse | null>(null);
  const [plan, setPlan] = useState<InterviewPlan | null>(null);
  const [mode, setMode] = useState<Mode>("text");
  const [report, setReport] = useState<FeedbackReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiStatus()
      .then((s) => {
        setVoiceAvailable(s.elevenlabs);
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

  async function onComplete(transcript: Transcript) {
    if (!plan) return;
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
    setError(null);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Adaptive Mock Interviewer</h1>
        <p className="text-zinc-500">
          Paste a job description, set guidelines, and practice with an AI interviewer that adapts.
        </p>
      </header>

      <div className="mb-6">
        <StatusBanner />
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {step === "config" && <ConfigForm voiceAvailable={voiceAvailable} onPrepared={onPrepared} />}

      {step === "interview" && prep && plan && (
        <section className="space-y-4">
          <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
            Interviewing for <span className="font-medium">{plan.role}</span> · {plan.competencies.length} competencies
            {prep.cached ? " · (cached plan)" : ""}
            {prep.fallback ? " · (generic fallback plan — generation failed)" : ""}
          </div>
          {mode === "voice" && agentId ? (
            <VoiceInterview agentId={agentId} overrides={prep.overrides} onComplete={onComplete} />
          ) : (
            <TextInterview systemPrompt={prep.systemPrompt} firstMessage={prep.firstMessage} onComplete={onComplete} />
          )}
        </section>
      )}

      {step === "scoring" && <p className="text-zinc-500">Scoring your interview…</p>}

      {step === "report" && report && plan && <ReportView report={report} plan={plan} onRestart={restart} />}
    </main>
  );
}
