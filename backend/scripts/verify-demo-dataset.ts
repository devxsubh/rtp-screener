import { readFileSync } from "fs";
import { join } from "path";
import { parseCapTableDetailed } from "../src/lib/screening/parseCapTable";
import {
  buildOwnershipGraph,
  computeEffectiveStakeInStartup,
  findOwnershipCycles,
  getStartupNode,
  resolveUltimateOwners,
} from "../src/lib/screening/graph";

const csvPath = join(__dirname, "../sample-data/sample-cap-table.csv");
const csv = readFileSync(csvPath, "utf-8");

const parsed = parseCapTableDetailed(csv);
if (parsed.errors.length > 0) {
  console.error("CSV parse failed:", parsed.errors);
  process.exit(1);
}

const graph = buildOwnershipGraph(parsed.records);
const startup = getStartupNode(graph);

const checks: Array<{ label: string; ok: boolean; detail: string }> = [];

function expect(label: string, ok: boolean, detail: string) {
  checks.push({ label, ok, detail });
}

expect(
  "Startup node",
  startup === "NexaFlow AI Inc",
  `got "${startup}"`,
);

const near = (a: number, b: number, tol = 0.15) => Math.abs(a - b) <= tol;

expect(
  "Ivan indirect stake ~12%",
  near(computeEffectiveStakeInStartup(graph, startup, "Ivan Petrovich Kozlov"), 12),
  `got ${computeEffectiveStakeInStartup(graph, startup, "Ivan Petrovich Kozlov")}%`,
);

expect(
  "Johan indirect stake ~13%",
  near(computeEffectiveStakeInStartup(graph, startup, "Johan Petrovitch Kozlov"), 13),
  `got ${computeEffectiveStakeInStartup(graph, startup, "Johan Petrovitch Kozlov")}%`,
);

expect(
  "Mohammed indirect stake ~2.2%",
  near(computeEffectiveStakeInStartup(graph, startup, "Mohammed Al Rahman"), 2.24),
  `got ${computeEffectiveStakeInStartup(graph, startup, "Mohammed Al Rahman")}%`,
);

expect(
  "Emma direct stake 18%",
  near(computeEffectiveStakeInStartup(graph, startup, "Emma Richardson"), 18),
  `got ${computeEffectiveStakeInStartup(graph, startup, "Emma Richardson")}%`,
);

expect(
  "Atlantic Bridge direct 20%",
  near(computeEffectiveStakeInStartup(graph, startup, "Atlantic Bridge Ventures Ltd"), 20),
  `got ${computeEffectiveStakeInStartup(graph, startup, "Atlantic Bridge Ventures Ltd")}%`,
);

const cycles = findOwnershipCycles(graph);
expect(
  "Circular ownership detected",
  cycles.length >= 1,
  `found ${cycles.length} cycle(s)`,
);

const cascadeUbos = resolveUltimateOwners(graph, "Cascade Series A SPV LLC");
expect(
  "Cascade SPV UBO is Ivan",
  cascadeUbos.includes("Ivan Petrovich Kozlov"),
  `got [${cascadeUbos.join(", ")}]`,
);

const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  console.log(`${c.ok ? "✓" : "✗"} ${c.label}: ${c.detail}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} check(s) FAILED`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} demo dataset checks PASSED`);
