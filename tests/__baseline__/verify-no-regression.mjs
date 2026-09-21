// Regression gate: compare a vitest JSON run against the known-fails baseline.
//
// Contract: PASS when no test that is expected to pass now fails. New tests are
// allowed. Any failing test (or suite that fails to collect) that is NOT in
// known-fails.txt is treated as a regression.
//
// Usage:
//   node tests/__baseline__/verify-no-regression.mjs <results.json>   # check
//   node tests/__baseline__/verify-no-regression.mjs --update <results.json>
//
// Exit codes: 0 = no regression (or baseline updated), 1 = regression, 2 = bad usage.
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

// The script lives at <repo>/tests/__baseline__/, so ../../ is the repo root.
// Using the real root (instead of a hardcoded "/app/" Docker prefix) keeps the
// baseline identical whether the suite runs in CI, Docker, or a local checkout.
const repoRoot = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
const baselinePath = new URL("./known-fails.txt", import.meta.url);

const args = process.argv.slice(2);
const update = args.includes("--update");
const resultsPath = args.find((a) => !a.startsWith("--"));
if (!resultsPath) {
  console.error("Usage: verify-no-regression.mjs [--update] <results.json>");
  process.exit(2);
}

const rel = (p) => path.relative(repoRoot, p).split(path.sep).join("/");

// Collect every current failure as "<path relative to repo root> :: <test name>".
// A suite that fails without any failed assertion (e.g. an import error) is a
// collection failure and is recorded under a synthetic name so it can't hide.
function collectFailures(results) {
  const fails = [];
  for (const suite of results.testResults || []) {
    const assertions = suite.assertionResults || [];
    const failed = assertions.filter((a) => a.status === "failed");
    if (failed.length) {
      for (const a of failed) fails.push(`${rel(suite.name)} :: ${a.fullName}`);
    } else if (suite.status === "failed") {
      fails.push(`${rel(suite.name)} :: <collection error>`);
    }
  }
  return [...new Set(fails)].sort();
}

const results = JSON.parse(readFileSync(resultsPath, "utf8"));
const nowFails = collectFailures(results);

if (update) {
  writeFileSync(baselinePath, nowFails.join("\n") + "\n");
  console.log(`Baseline updated: ${nowFails.length} known failures -> known-fails.txt`);
  process.exit(0);
}

const knownFails = new Set(
  readFileSync(baselinePath, "utf8").split("\n").map((s) => s.trim()).filter(Boolean),
);

// Regression = failing now but not present in the baseline.
const regressions = nowFails.filter((f) => !knownFails.has(f));

if (regressions.length) {
  console.error(`\n❌ REGRESSION: ${regressions.length} test(s) pass→fail:\n`);
  for (const f of regressions) console.error("  - " + f);
  console.error(`\n(now failing=${nowFails.length}, baseline known=${knownFails.size})`);
  process.exit(1);
}

console.log(
  `✅ No regression. (now failing=${nowFails.length}, baseline known=${knownFails.size}, all known)`,
);
