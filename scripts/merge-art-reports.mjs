// Merge disjoint runs of the complete suite after environment-limited execution.
import { readFileSync, writeFileSync } from "node:fs";
const root = "evidence/art-v1";
const inputs = ["gameplay", "benchmarks", "art-benchmark"];
const reports = inputs.map((name) =>
  JSON.parse(readFileSync(`${root}/browser-results-${name}.json`)),
);
const specs = (suites) =>
  suites.flatMap((s) => [...(s.specs ?? []), ...specs(s.suites ?? [])]);
const allSpecs = reports.flatMap((r) => specs(r.suites));
const ids = allSpecs.map((s) => s.id);
if (new Set(ids).size !== ids.length)
  throw new Error("Overlapping tests in merged runs");
if (
  allSpecs.length !== 31 ||
  allSpecs.some((s) => !s.ok) ||
  reports.some((r) => r.errors.length)
)
  throw new Error("Full 31-check suite has not passed");
const merged = {
  config: reports[0].config,
  suites: reports.flatMap((r) => r.suites),
  errors: [],
  stats: {
    startTime: reports.map((r) => r.stats.startTime).sort()[0],
    duration: reports.reduce((n, r) => n + r.stats.duration, 0),
    expected: 31,
    skipped: 0,
    unexpected: 0,
    flaky: 0,
  },
  validationRuns: inputs.map((name, i) => ({
    file: `browser-results-${name}.json`,
    stats: reports[i].stats,
  })),
  executionNote:
    "Disjoint runs cover all 31 tests. Native WebRTC gameplay outside process sandbox; benchmark-only runs inside sandbox. See pipeline documentation.",
};
writeFileSync(
  `${root}/browser-results.json`,
  JSON.stringify(merged, null, 2) + "\n",
);
writeFileSync(
  `${root}/browser-test.log`,
  "Complete 31-check suite through three disjoint runs; see JSON executionNote.\n\n" +
    inputs
      .map((name) => readFileSync(`${root}/browser-${name}.log`, "utf8"))
      .join("\n"),
);
console.log("Merged 31 passing checks from three disjoint runs");
