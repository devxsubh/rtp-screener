import { getScreeningThresholds } from "./screeningConfig";

export type RiskLevel = "clear" | "review" | "flagged";

export function classifyScore(topScore: number | null): RiskLevel {
  const t = getScreeningThresholds();
  if (topScore === null) return "clear";
  if (topScore >= t.flaggedMinScore) return "flagged";
  if (topScore >= t.reviewMinScore) return "review";
  return "clear";
}
