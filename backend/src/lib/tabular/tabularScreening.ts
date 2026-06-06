import type { ColumnConfig } from "../../types/tabular";
import type { EntityResult, RiskLevel, ScreeningResult } from "../../types/screening";

export const PORTFOLIO_COLUMNS: ColumnConfig[] = [
  {
    index: 0,
    name: "Last screened",
    format: "text",
    prompt: "When was this company last screened?",
  },
  {
    index: 1,
    name: "Open flags",
    format: "text",
    prompt: "Count of flagged and review-tier entities.",
  },
  {
    index: 2,
    name: "Highest-risk entity",
    format: "text",
    prompt: "Name of the highest-risk entity on the cap table.",
  },
  {
    index: 3,
    name: "Sanctioned exposure",
    format: "text",
    prompt: "Maximum indirect sanctioned ownership stake in the portfolio company (%).",
  },
  {
    index: 4,
    name: "Co-investor risk",
    format: "text",
    prompt: "Sanctions risk summary from co-investor / vendor roster screening.",
  },
  {
    index: 5,
    name: "Status",
    format: "text",
    prompt: "Leave blank for the compliance officer to complete.",
  },
];

export const ENTITY_SCREENING_COLUMNS: ColumnConfig[] = [
  { index: 0, name: "Entity", format: "text", prompt: "Entity name" },
  { index: 1, name: "Type", format: "text", prompt: "Person or company" },
  {
    index: 2,
    name: "Ultimate Owner?",
    format: "yes_no",
    prompt: "Is this the ultimate beneficial owner?",
  },
  {
    index: 3,
    name: "Ownership Path",
    format: "text",
    prompt: "Ownership chain to portfolio company",
  },
  {
    index: 4,
    name: "Indirect %",
    format: "text",
    prompt: "Effective indirect ownership stake in the portfolio company",
  },
  {
    index: 5,
    name: "Sanctions Match",
    format: "text",
    prompt: "Closest sanctions list match",
  },
  {
    index: 6,
    name: "Match Score",
    format: "text",
    prompt: "Match confidence 0–100%",
  },
  {
    index: 7,
    name: "Source List",
    format: "text",
    prompt: "Sanctions list source",
  },
  { index: 8, name: "Risk", format: "tag", prompt: "Clear / Review / Flagged" },
  {
    index: 9,
    name: "Status",
    format: "text",
    prompt: "Human sign-off — leave blank initially",
  },
];

export function riskToFlag(
  risk: RiskLevel | null | undefined,
): "green" | "grey" | "yellow" | "red" {
  if (risk === "flagged") return "red";
  if (risk === "review") return "yellow";
  if (risk === "clear") return "green";
  return "grey";
}

export function formatOpenFlags(flagged: number, review: number): string {
  if (flagged === 0 && review === 0) return "None";
  const parts: string[] = [];
  if (flagged > 0) parts.push(`${flagged} flagged`);
  if (review > 0) parts.push(`${review} review`);
  return parts.join(", ");
}

export function formatCoInvestorRisk(summary: {
  flaggedCount: number;
  reviewCount: number;
} | null): string {
  if (!summary) return "Not screened";
  if (summary.flaggedCount === 0 && summary.reviewCount === 0) return "Clear";
  const parts: string[] = [];
  if (summary.flaggedCount > 0) parts.push(`${summary.flaggedCount} flagged`);
  if (summary.reviewCount > 0) parts.push(`${summary.reviewCount} review`);
  return parts.join(", ");
}

export function entityToCells(
  entity: EntityResult,
): Map<number, { summary: string; flag: "green" | "grey" | "yellow" | "red" }> {
  const topMatch = entity.matches[0];
  const scorePct =
    entity.topScore != null ? `${Math.round(entity.topScore * 100)}%` : "—";
  const path =
    entity.ownershipPath.length > 0
      ? entity.ownershipPath.join(" → ")
      : "Direct";

  const map = new Map<
    number,
    { summary: string; flag: "green" | "grey" | "yellow" | "red" }
  >();
  map.set(0, { summary: entity.name, flag: riskToFlag(entity.riskLevel) });
  map.set(1, {
    summary: entity.type === "person" ? "Person" : "Company",
    flag: "grey",
  });
  map.set(2, {
    summary: entity.isUltimateOwner ? "Yes" : "No",
    flag: "grey",
  });
  map.set(3, { summary: path, flag: "grey" });
  map.set(4, {
    summary:
      entity.indirectOwnershipPct != null
        ? `${entity.indirectOwnershipPct.toFixed(1)}%`
        : "—",
    flag: riskToFlag(entity.riskLevel),
  });
  map.set(5, {
    summary: topMatch?.sdnName ?? "No match",
    flag: riskToFlag(entity.riskLevel),
  });
  map.set(6, { summary: scorePct, flag: riskToFlag(entity.riskLevel) });
  map.set(7, {
    summary: topMatch?.programs?.join(", ") ?? "—",
    flag: "grey",
  });
  map.set(8, {
    summary:
      entity.riskLevel === "clear"
        ? "Clear"
        : entity.riskLevel === "review"
          ? "Review"
          : "Flagged",
    flag: riskToFlag(entity.riskLevel),
  });
  map.set(9, { summary: "", flag: "grey" });
  return map;
}

export function screeningResultToRows(result: ScreeningResult): {
  rowIds: string[];
  rows: { id: string; name: string; meta: Record<string, unknown> }[];
} {
  const rowIds: string[] = [];
  const rows: { id: string; name: string; meta: Record<string, unknown> }[] = [];

  for (const entity of result.entities) {
    const id = `entity:${encodeURIComponent(entity.name)}`;
    rowIds.push(id);
    rows.push({
      id,
      name: entity.name,
      meta: { riskLevel: entity.riskLevel },
    });
  }

  return { rowIds, rows };
}

export function portfolioStartupRowId(startupId: string): string {
  return `startup:${startupId}`;
}
