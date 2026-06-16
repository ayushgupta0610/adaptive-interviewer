export interface Competency {
  label: string;
  /** 0–5 rubric score. */
  score: number;
}
export interface RoleSample {
  id: string;
  role: string;
  competencies: Competency[];
  strength: string;
  gap: string;
}

/** Sample scorecards shown on the marketing carousel. Illustrative, not real user data. */
export const ROLE_SAMPLES: RoleSample[] = [
  {
    id: "backend",
    role: "Backend Engineer · Senior",
    competencies: [
      { label: "System design", score: 4.2 },
      { label: "Communication", score: 3.6 },
      { label: "Trade-off reasoning", score: 3.1 },
    ],
    strength: "Strong on partitioning; gave a concrete rebalancing strategy with backpressure.",
    gap: "Glossed over failure modes. Practice naming the trade-off you're rejecting and why.",
  },
  {
    id: "pm",
    role: "Product Manager",
    competencies: [
      { label: "Product sense", score: 3.9 },
      { label: "Prioritization", score: 4.1 },
      { label: "Stakeholder comms", score: 3.4 },
    ],
    strength: "Framed the problem around a measurable user outcome before jumping to features.",
    gap: "Prioritization rationale stayed qualitative — tie it to an explicit impact/effort call.",
  },
  {
    id: "data",
    role: "Data Scientist",
    competencies: [
      { label: "ML fundamentals", score: 4.0 },
      { label: "Experiment design", score: 3.3 },
      { label: "Communication", score: 3.7 },
    ],
    strength: "Chose an appropriate baseline and justified the metric for the business question.",
    gap: "Didn't address leakage in the proposed validation split — call it out proactively.",
  },
  {
    id: "design",
    role: "UX Designer",
    competencies: [
      { label: "Craft", score: 4.3 },
      { label: "Process", score: 3.5 },
      { label: "Systems thinking", score: 3.2 },
    ],
    strength: "Connected the visual decision back to a concrete usability hypothesis.",
    gap: "Skipped how you'd validate with users — name the test and the signal you'd watch.",
  },
  {
    id: "ae",
    role: "Account Executive",
    competencies: [
      { label: "Discovery", score: 3.8 },
      { label: "Objection handling", score: 4.0 },
      { label: "Closing", score: 3.4 },
    ],
    strength: "Reframed a price objection around value and quantified the cost of inaction.",
    gap: "Next step at the end was vague — propose a specific, time-bound mutual action.",
  },
];
