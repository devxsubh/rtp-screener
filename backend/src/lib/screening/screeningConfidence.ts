import type { EntityResult, RiskLevel } from "../../types/screening";

/** Persons weigh more — UBO risk is the primary compliance concern. */
const ENTITY_WEIGHT: Record<"person" | "company", number> = {
  person: 2,
  company: 1,
};

/**
 * Credit per risk bucket. Higher = cleaner from a screening perspective.
 * Review is partial credit (borderline match needs human eyes).
 */
const RISK_CREDIT: Record<RiskLevel, number> = {
  clear: 1,
  review: 0.5,
  flagged: 0,
};

export interface ScreeningCoverage {
  total: number;
  assessed: number;
  flagged: number;
  review: number;
  clear: number;
  /** 0–100 deterministic score — computed in code, never by the LLM. */
  confidence: number;
}

/**
 * Aggregate screening confidence (ic-copilot-style deterministic scoring).
 * Reflects how clean the cap table looks after a complete Watchman pass:
 * weighted by entity type, dampened by review/flagged concentration.
 */
export function scoreScreeningConfidence(
  entities: EntityResult[],
): ScreeningCoverage {
  const total = entities.length;
  if (total === 0) {
    return {
      total: 0,
      assessed: 0,
      flagged: 0,
      review: 0,
      clear: 0,
      confidence: 0,
    };
  }

  const flagged = entities.filter((e) => e.riskLevel === "flagged").length;
  const review = entities.filter((e) => e.riskLevel === "review").length;
  const clear = entities.filter((e) => e.riskLevel === "clear").length;

  let weightSum = 0;
  let creditSum = 0;
  for (const entity of entities) {
    const weight = ENTITY_WEIGHT[entity.type] ?? 1;
    weightSum += weight;
    creditSum += weight * RISK_CREDIT[entity.riskLevel];
  }

  const base = weightSum > 0 ? creditSum / weightSum : 0;
  const assessed = total;
  const coverage = assessed / total;
  const confidence = Math.round(base * (0.5 + 0.5 * coverage) * 100);

  return { total, assessed, flagged, review, clear, confidence };
}
