import { readFileSync } from "fs";
import { join } from "path";
import { buildOwnershipGraph, computeEffectiveStakeInStartup, getStartupNode } from "../src/lib/screening/graph";

const csv = readFileSync(
  join(__dirname, "../sample-data/sample-cap-table.csv"),
  "utf-8",
);

// Minimal parse for test — reuse strict rows
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
const beta = computeEffectiveStakeInStartup(graph, startup, "Beta Capital Partners");
const john = computeEffectiveStakeInStartup(graph, startup, "John Smith");

console.log("Startup:", startup);
console.log("Ivan → portco:", ivan, "(expected ~20)");
console.log("Johan → portco:", johan, "(expected ~10)");
console.log("Beta → portco:", beta, "(expected ~25)");
console.log("John → portco:", john, "(expected ~20)");

const ok =
  Math.abs(ivan - 20) < 0.1 &&
  Math.abs(johan - 10) < 0.1 &&
  Math.abs(beta - 25) < 0.1 &&
  Math.abs(john - 20) < 0.1;

if (!ok) {
  console.error("Ownership math check FAILED");
  process.exit(1);
}
console.log("Ownership math check PASSED");
