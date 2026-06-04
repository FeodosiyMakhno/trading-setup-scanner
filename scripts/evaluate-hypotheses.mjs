import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "../src/runtime/env.mjs";
import { readJsonLines } from "../src/storage/jsonl.mjs";
import {
  defaultHypothesesFile,
  evaluateHypothesis,
  formatEvaluationLine,
} from "../src/tracking/hypotheses.mjs";

await loadEnvFile();

const hypothesesFile = resolve(process.env.HYPOTHESES_FILE ?? defaultHypothesesFile);
const outputFile = resolve(process.env.HYPOTHESES_EVALUATION_FILE ?? "reports/hypothesis-evaluation.json");
const snapshotsFile = resolve(process.env.SNAPSHOTS_FILE ?? "data/market-snapshots.jsonl");
const hypotheses = await readJsonLines(hypothesesFile);
const snapshots = await readJsonLines(snapshotsFile);
const evaluations = hypotheses.map((hypothesis) => evaluateHypothesis(hypothesis, snapshots));

const report = {
  generatedAt: new Date().toISOString(),
  hypothesesFile,
  snapshotsFile,
  hypotheses: hypotheses.length,
  evaluations,
  summary: summarize(evaluations),
};

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`Hypotheses read: ${hypotheses.length}`);
console.log(`Snapshots read: ${snapshots.length}`);
console.log(`Evaluation written: ${outputFile}`);
console.log("");
console.log("Summary:");
for (const [key, value] of Object.entries(report.summary)) {
  console.log(`  ${key}: ${value}`);
}
console.log("");
console.log("Evaluations:");
for (const item of evaluations) {
  console.log(formatEvaluationLine(item));
}

function summarize(items) {
  const summary = {
    total: items.length,
    pending: 0,
    ready: 0,
    early: 0,
  };

  for (const item of items) {
    summary[item.status] = (summary[item.status] ?? 0) + 1;
    summary[item.verdict] = (summary[item.verdict] ?? 0) + 1;
  }

  return summary;
}
