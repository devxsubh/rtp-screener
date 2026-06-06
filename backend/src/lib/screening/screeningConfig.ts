/** Firm screening thresholds — env overrides for demo tuning. */
export interface ScreeningThresholds {
  watchmanMinMatch: number;
  flaggedMinScore: number;
  reviewMinScore: number;
  /** FinCEN-style beneficial-owner review threshold (default 25%). */
  beneficialOwnerPct: number;
  /** OFAC 50% ownership / control rule threshold (default 50%). */
  ofacOwnershipRulePct: number;
  /** Max Watchman hits per entity (default 10, max 100). */
  watchmanResultLimit: number;
  /** Include field-level match breakdown from Watchman (?debug=true). */
  watchmanDebug: boolean;
}

export function getScreeningThresholds(): ScreeningThresholds {
  const num = (key: string, fallback: number) => {
    const raw = process.env[key];
    if (!raw) return fallback;
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  return {
    watchmanMinMatch: num("SCREENING_WATCHMAN_MIN_MATCH", 0.8),
    flaggedMinScore: num("SCREENING_FLAGGED_MIN_SCORE", 0.95),
    reviewMinScore: num("SCREENING_REVIEW_MIN_SCORE", 0.8),
    beneficialOwnerPct: num("SCREENING_UBO_PCT_THRESHOLD", 25),
    ofacOwnershipRulePct: num("SCREENING_OFAC_50_PCT_THRESHOLD", 50),
    watchmanResultLimit: Math.min(
      100,
      Math.max(1, Math.round(num("SCREENING_WATCHMAN_RESULT_LIMIT", 10))),
    ),
    watchmanDebug: process.env.SCREENING_WATCHMAN_DEBUG !== "false",
  };
}
