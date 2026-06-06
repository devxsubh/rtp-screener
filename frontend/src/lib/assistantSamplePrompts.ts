export type AssistantSamplePrompt = {
  label: string;
  prompt: string;
};

export const ASSISTANT_SAMPLE_PROMPTS: AssistantSamplePrompt[] = [
  {
    label: "Screen cap table",
    prompt:
      "Run a sanctions screen on the attached cap table. Summarize total entities and counts by risk tier (flagged / review / clear).",
  },
  {
    label: "Find hidden UBOs",
    prompt:
      "Trace ownership chains through SPVs, offshore holdings, and trusts. Who are the ultimate beneficial owners not listed directly on the cap table?",
  },
  {
    label: "Review flagged entities",
    prompt:
      "Which entities are flagged or need human review? Explain the highest-risk matches and their ownership paths.",
  },
  {
    label: "AML summary",
    prompt:
      "Produce a structured AML screening summary for our compliance files — scope, results, items requiring review, and sign-off placeholder.",
  },
  {
    label: "IC memo outline",
    prompt:
      "Draft an Investment Committee compliance memo outline from the screening results, including recommended next steps for the compliance team.",
  },
];
