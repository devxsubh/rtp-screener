import type { DirectedGraph } from "graphology";
import { ingestCsv, toIngestApiResponse } from "./csvIngest";
import {
  buildOwnershipGraph,
  findOwnershipCycles,
  getAllNodes,
  getEdges,
  getStartupNode,
} from "./graph";

export interface GraphPreview {
  entityCount: number;
  edgeCount: number;
  startupName: string | null;
  ownershipDepth: number;
  hasCircularOwnership: boolean;
  circularOwnershipCount: number;
}

export interface ScreeningPreviewResult {
  graphPreview: GraphPreview | null;
  /** Rough seconds before Watchman + narratives complete. */
  estimatedScreenSeconds: number;
}

/** Longest owner chain above the portfolio company (hops to ultimate owner). */
export function computeOwnershipDepth(
  graph: DirectedGraph,
  startup: string,
): number {
  if (!graph.hasNode(startup)) return 0;

  let maxDepth = 0;
  const queue: { node: string; depth: number }[] = [{ node: startup, depth: 0 }];
  const visited = new Set<string>([startup]);

  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;
    maxDepth = Math.max(maxDepth, depth);

    for (const owner of graph.inNeighbors(node)) {
      if (!visited.has(owner)) {
        visited.add(owner);
        queue.push({ node: owner, depth: depth + 1 });
      }
    }
  }

  return maxDepth;
}

function estimateScreenSeconds(entityCount: number): number {
  return Math.max(3, Math.ceil(entityCount * 0.5) + 2);
}

export async function buildScreeningPreview(
  csv: string,
  filename?: string,
): Promise<ReturnType<typeof toIngestApiResponse> & ScreeningPreviewResult> {
  const ingest = await ingestCsv(csv, filename?.trim());
  const base = toIngestApiResponse(ingest);

  let graphPreview: GraphPreview | null = null;
  let entityCount = 0;

  if (ingest.csvKind === "ownership_cap_table" && ingest.records.length > 0) {
    const graph = buildOwnershipGraph(ingest.records);
    const startup = getStartupNode(graph);
    const cycles = findOwnershipCycles(graph);
    const nodes = getAllNodes(graph);
    entityCount = nodes.length;

    graphPreview = {
      entityCount,
      edgeCount: getEdges(graph).length,
      startupName: startup ?? null,
      ownershipDepth: startup ? computeOwnershipDepth(graph, startup) : 0,
      hasCircularOwnership: cycles.length > 0,
      circularOwnershipCount: cycles.length,
    };
  } else if (ingest.csvKind === "entity_roster") {
    entityCount = ingest.rosterEntities.length;
    graphPreview = {
      entityCount,
      edgeCount: 0,
      startupName: null,
      ownershipDepth: 0,
      hasCircularOwnership: false,
      circularOwnershipCount: 0,
    };
  }

  return {
    ...base,
    graphPreview,
    estimatedScreenSeconds: ingest.canScreen
      ? estimateScreenSeconds(entityCount)
      : 0,
  };
}
