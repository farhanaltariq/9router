// Runs the vitest suite as JSON, then applies the regression gate.
//
// vitest exits non-zero whenever any test fails, which would make a plain
// `vitest && gate` chain stop before the gate runs. This wrapper runs both
// regardless and reports the gate's verdict.
//
// Usage:
//   node __baseline__/run.mjs            # check against known-fails.txt
//   node __baseline__/run.mjs --update   # rewrite known-fails.txt from this run
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testsDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const resultsPath = path.join(testsDir, ".vitest-results.json");
const update = process.argv.includes("--update");

const vitest = path.join(testsDir, "node_modules", ".bin", "vitest");
if (!existsSync(vitest)) {
  console.error(
    `vitest not found at ${vitest}\n` +
      "Install the test dependencies first:  cd tests && npm install",
  );
  process.exit(2);
}
const run = spawnSync(
  vitest,
  ["run", "--reporter=json", `--outputFile=${resultsPath}`],
  { cwd: testsDir, stdio: "inherit" },
);
if (run.error) {
  console.error(`Failed to run vitest: ${run.error.message}`);
  process.exit(2);
}

const gateArgs = [
  path.join(testsDir, "__baseline__", "verify-no-regression.mjs"),
  ...(update ? ["--update"] : []),
  resultsPath,
];
const gate = spawnSync(process.execPath, gateArgs, { cwd: testsDir, stdio: "inherit" });
process.exit(gate.status ?? 1);
