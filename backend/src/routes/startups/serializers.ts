import type { RosterPurpose, ScreeningSummary } from "../../types/screening";

export function toStartup(raw: unknown) {
  const s = raw as Record<string, unknown>;
  return {
    id: String(s._id),
    name: s.name,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt ?? null,
    latestCsvId: s.latestCsvId ? String(s.latestCsvId) : null,
    latestCsvByPurpose: s.latestCsvByPurpose ?? {},
    lastScreeningResult: s.lastScreeningResult ?? null,
    lastScreenedAt: s.lastScreenedAt ?? null,
    lastScreenedCsvId: s.lastScreenedCsvId ? String(s.lastScreenedCsvId) : null,
    lastCoInvestorScreeningResult: s.lastCoInvestorScreeningResult ?? null,
    lastCoInvestorScreenedAt: s.lastCoInvestorScreenedAt ?? null,
    lastVendorScreeningResult: s.lastVendorScreeningResult ?? null,
    lastVendorScreenedAt: s.lastVendorScreenedAt ?? null,
    portfolioReviewStatus: s.portfolioReviewStatus ?? "pending",
    portfolioReviewNotes: s.portfolioReviewNotes ?? null,
  };
}

export function toCsv(raw: unknown) {
  const c = raw as Record<string, unknown>;
  return {
    id: String(c._id),
    startupId: String(c.startupId),
    filename: c.filename,
    content: c.content,
    uploadedAt: c.uploadedAt,
    updatedAt: c.updatedAt ?? null,
    parseStatus: c.parseStatus ?? "pending",
    parseErrors: c.parseErrors ?? [],
    recordCount: c.recordCount ?? 0,
    csvKind: c.csvKind ?? null,
    parseSource: c.parseSource ?? null,
    confidence: c.confidence ?? null,
    columnMapping: c.columnMapping ?? null,
    normalizedContent: c.normalizedContent ?? null,
    ingestWarnings: c.ingestWarnings ?? [],
    rosterPurpose: c.rosterPurpose ?? "cap_table",
  };
}

export function toReview(raw: Record<string, unknown> | null) {
  if (!raw) return null;
  return {
    id: String(raw._id),
    startupId: String(raw.startupId),
    entityName: raw.entityName,
    status: raw.status,
    notes: raw.notes ?? null,
    reviewedBy: raw.reviewedBy,
    reviewedByEmail: raw.reviewedByEmail,
    reviewedAt: raw.reviewedAt,
  };
}

export function toScreeningSummary(raw: unknown): ScreeningSummary {
  const s = raw as Record<string, unknown>;
  const result = s.lastScreeningResult as
    | {
        totalEntities?: number;
        flaggedCount?: number;
        reviewCount?: number;
        entities?: Array<{ name: string; riskLevel: string }>;
      }
    | null
    | undefined;

  let highestRiskEntity: string | null = null;
  let highestRiskLevel: ScreeningSummary["highestRiskLevel"] = null;

  if (result?.entities?.length) {
    const flagged = result.entities.find((e) => e.riskLevel === "flagged");
    const review = result.entities.find((e) => e.riskLevel === "review");
    const top = flagged ?? review ?? null;
    if (top) {
      highestRiskEntity = top.name;
      highestRiskLevel = top.riskLevel as ScreeningSummary["highestRiskLevel"];
    }
  }

  return {
    startupId: String(s._id),
    startupName: s.name as string,
    lastScreenedAt: s.lastScreenedAt
      ? new Date(s.lastScreenedAt as string).toISOString()
      : null,
    totalEntities: result?.totalEntities ?? 0,
    flaggedCount: result?.flaggedCount ?? 0,
    reviewCount: result?.reviewCount ?? 0,
    highestRiskEntity,
    highestRiskLevel,
  };
}

export function purposeStorageKey(purpose: RosterPurpose): string {
  if (purpose === "co_investor") return "co_investor";
  if (purpose === "vendor") return "vendor";
  return "cap_table";
}
