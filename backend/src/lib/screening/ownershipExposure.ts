import type { DirectedGraph } from "graphology";
import type { EntityResult, OwnershipRuleFlag, RiskLevel } from "../../types/screening";
import { getScreeningThresholds } from "./screeningConfig";
import {
  computeEffectiveStakeInStartup,
  findHighestStakePath,
} from "./graph";

/** OFAC 50% rule: entity is blockable if sanctioned parties own ≥ threshold in aggregate. */
export function isEntityBlockedBy50Rule(
  graph: DirectedGraph,
  entity: string,
  sanctionedNames: Set<string>,
  cache: Map<string, boolean> = new Map(),
  visiting: Set<string> = new Set(),
): boolean {
  if (cache.has(entity)) return cache.get(entity)!;

  if (sanctionedNames.has(entity)) {
    cache.set(entity, true);
    return true;
  }

  // Circular ownership (e.g. Apex ↔ Loopback) — stop recursion on revisits.
  if (visiting.has(entity)) {
    return false;
  }
  visiting.add(entity);

  const threshold = getScreeningThresholds().ofacOwnershipRulePct;
  let aggregate = 0;

  for (const owner of graph.inNeighbors(entity)) {
    const edgeKey = graph.edge(owner, entity);
    if (!edgeKey) continue;
    const pct = graph.getEdgeAttribute(edgeKey, "pct") as number;
    if (
      sanctionedNames.has(owner) ||
      isEntityBlockedBy50Rule(graph, owner, sanctionedNames, cache, visiting)
    ) {
      aggregate += pct;
    }
  }

  visiting.delete(entity);
  const blocked = aggregate >= threshold;
  cache.set(entity, blocked);
  return blocked;
}

export function deriveOwnershipRuleFlags(
  indirectPct: number | null,
  blockedBy50Rule: boolean,
): OwnershipRuleFlag[] {
  const t = getScreeningThresholds();
  const flags: OwnershipRuleFlag[] = [];

  if (blockedBy50Rule) flags.push("ofac_50");
  else if (indirectPct !== null && indirectPct >= t.ofacOwnershipRulePct) {
    flags.push("ofac_50");
  }

  if (indirectPct !== null && indirectPct >= t.beneficialOwnerPct) {
    flags.push("ubo_25");
  }

  return flags;
}

export function escalateRiskForOwnership(
  current: RiskLevel,
  flags: OwnershipRuleFlag[],
  hasSanctionsHit: boolean,
): RiskLevel {
  if (!hasSanctionsHit && !flags.includes("ofac_50")) return current;

  if (flags.includes("ofac_50")) {
    if (current === "clear" && hasSanctionsHit) return "review";
    if (current === "review") return "flagged";
  }

  if (flags.includes("ubo_25") && current === "clear" && hasSanctionsHit) {
    return "review";
  }

  return current;
}

export function buildExposureStatement(
  entityName: string,
  startup: string,
  indirectPct: number | null,
  ownershipPath: string[],
  flags: OwnershipRuleFlag[],
  blockedBy50Rule: boolean,
): string | undefined {
  if (blockedBy50Rule && ownershipPath.length <= 1) {
    return `${entityName} may be subject to the OFAC 50% rule — aggregate ownership by sanctioned or blockable parties is ≥ ${getScreeningThresholds().ofacOwnershipRulePct}%.`;
  }

  if (indirectPct === null || indirectPct <= 0) return undefined;

  const pct = indirectPct.toFixed(1);
  const layers = Math.max(0, ownershipPath.length - 1);

  if (layers <= 1) {
    return `${pct}% of ${startup} is directly held by ${entityName}, which matched a sanctions list.`;
  }

  let statement = `${pct}% of ${startup} is indirectly owned by ${entityName} through a ${layers}-layer ownership chain.`;

  if (flags.includes("ofac_50")) {
    statement += ` This meets the OFAC 50% ownership threshold.`;
  } else if (flags.includes("ubo_25")) {
    statement += ` This exceeds the ${getScreeningThresholds().beneficialOwnerPct}% beneficial-owner review threshold.`;
  }

  return statement;
}

export function enrichEntityWithOwnershipExposure(
  entity: EntityResult,
  graph: DirectedGraph | null,
  startup: string | null,
  sanctionedNames: Set<string>,
  blockedCache: Map<string, boolean>,
): EntityResult {
  if (!graph || !startup) return entity;

  const indirectOwnershipPct = computeEffectiveStakeInStartup(
    graph,
    startup,
    entity.name,
  );
  const { steps } = findHighestStakePath(graph, startup, entity.name);

  const blockedBy50Rule =
    entity.type === "company" &&
    isEntityBlockedBy50Rule(graph, entity.name, sanctionedNames, blockedCache);

  const hasSanctionsHit = entity.riskLevel !== "clear";
  const flags = deriveOwnershipRuleFlags(
    hasSanctionsHit || blockedBy50Rule ? indirectOwnershipPct : null,
    blockedBy50Rule,
  );

  const escalatedRisk = escalateRiskForOwnership(
    blockedBy50Rule && entity.riskLevel === "clear" ? "review" : entity.riskLevel,
    flags,
    hasSanctionsHit,
  );

  const exposureStatement = buildExposureStatement(
    entity.name,
    startup,
    hasSanctionsHit || blockedBy50Rule ? indirectOwnershipPct : null,
    entity.ownershipPath,
    flags,
    blockedBy50Rule,
  );

  return {
    ...entity,
    indirectOwnershipPct:
      hasSanctionsHit || blockedBy50Rule ? indirectOwnershipPct : null,
    ownershipPathSteps: steps,
    ownershipRuleFlags: flags.length > 0 ? flags : undefined,
    exposureStatement,
    riskLevel: escalatedRisk,
  };
}

export function computeMaxSanctionedExposure(
  entities: EntityResult[],
): number | null {
  const values = entities
    .filter((e) => e.riskLevel !== "clear" && e.indirectOwnershipPct != null)
    .map((e) => e.indirectOwnershipPct as number);
  if (values.length === 0) return null;
  return Math.max(...values);
}

export function buildPortfolioExposureSummary(
  startup: string,
  entities: EntityResult[],
): string | undefined {
  const nonClear = entities.filter((e) => e.riskLevel !== "clear");
  if (nonClear.length === 0) return undefined;

  const maxPct = computeMaxSanctionedExposure(entities);
  const ofac50 = entities.filter((e) =>
    e.ownershipRuleFlags?.includes("ofac_50"),
  ).length;

  const parts = [
    `${nonClear.length} entit${nonClear.length === 1 ? "y" : "ies"} require review for ${startup}.`,
  ];
  if (maxPct !== null) {
    parts.push(`Maximum sanctioned indirect stake: ${maxPct.toFixed(1)}%.`);
  }
  if (ofac50 > 0) {
    parts.push(
      `${ofac50} entit${ofac50 === 1 ? "y" : "ies"} trigger OFAC 50% / UBO ownership rules.`,
    );
  }
  return parts.join(" ");
}
