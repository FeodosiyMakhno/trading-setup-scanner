import { spawn } from "node:child_process";

const intervalMinutes = Number(process.env.COLLECT_INTERVAL_MINUTES ?? 5);
const maxRuns = Number(process.env.COLLECT_RUNS ?? 12);

if (!Number.isFinite(intervalMinutes) || intervalMinutes < 0) {
  throw new Error("COLLECT_INTERVAL_MINUTES must be a non-negative number.");
}

if (!Number.isInteger(maxRuns) || maxRuns < 0) {
  throw new Error("COLLECT_RUNS must be a non-negative integer. Use 0 for infinite mode.");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runNodeScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      stdio: "inherit",
      env: process.env,
      shell: false,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${scriptPath} exited with code ${code}`));
    });
  });
}

let runNumber = 0;

console.log("Starting market snapshot collection loop.");
console.log(`Interval: ${intervalMinutes} minute(s)`);
console.log(`Runs: ${maxRuns === 0 ? "infinite" : maxRuns}`);
console.log("");

while (maxRuns === 0 || runNumber < maxRuns) {
  runNumber += 1;
  console.log(`=== Collection run ${runNumber}${maxRuns === 0 ? "" : `/${maxRuns}`} ===`);
  await runNodeScript("scripts/collect-snapshot.mjs");
  console.log("");
  console.log("=== Scan after collection ===");
  await runNodeScript("scripts/scan-snapshots.mjs");
  console.log("");

  if (maxRuns !== 0 && runNumber >= maxRuns) {
    break;
  }

  const waitMs = intervalMinutes * 60_000;
  if (waitMs > 0) {
    console.log(`Waiting ${intervalMinutes} minute(s) before next collection...`);
    await sleep(waitMs);
  }
}

console.log("Collection loop finished.");
