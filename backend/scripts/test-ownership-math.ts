import { readFileSync } from "fs";
import { join } from "path";
import {
  buildOwnershipGraph,
  computeEffectiveStakeInStartup,
  getStartupNode,
} from "../src/lib/screening/graph";

const csv = readFileSync(
  join(__dirname, "../sample-data/sample-cap-table.csv"),
  "utf-8",
);

const lines = csv.trim().split("\n").slice(1);
const records = lines.map((line) => {
  const [entity, entityType, owner, ownerType, pct] = line.split(",");
  return {
    entity,
    entityType: entityType as "person" | "company",
    owner,
    ownerType: ownerType as "person" | "company",
    ownershipPct: Number(pct),
  };
});

const graph = buildOwnershipGraph(records);
const startup = getStartupNode(graph);

const ivan = computeEffectiveStakeInStartup(graph, startup, "Ivan Petrovich Kozlov");
const johan = computeEffectiveStakeInStartup(graph, startup, "Johan Petrovitch Kozlov");
const atlantic = computeEffectiveStakeInStartup(
  graph,
  startup,
  "Atlantic Bridge Ventures Ltd",
);
const emma = computeEffectiveStakeInStartup(graph, startup, "Emma Richardson");

console.log("Startup:", startup);
console.log("Ivan → portco:", ivan, "(expected ~12)");
console.log("Johan → portco:", johan, "(expected ~13)");
console.log("Atlantic Bridge → portco:", atlantic, "(expected ~20)");
console.log("Emma → portco:", emma, "(expected ~18)");

const ok =
  Math.abs(ivan - 12) < 0.2 &&
  Math.abs(johan - 13) < 0.2 &&
  Math.abs(atlantic - 20) < 0.1 &&
  Math.abs(emma - 18) < 0.1;

if (!ok) {
  console.error("Ownership math check FAILED");
  process.exit(1);
}
console.log("Ownership math check PASSED");
