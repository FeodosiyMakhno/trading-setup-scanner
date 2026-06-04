import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvFile } from "../src/runtime/env.mjs";
import { appendJsonLines, readJsonLines } from "../src/storage/jsonl.mjs";
import { buildHypothesis, defaultHypothesesFile } from "../src/tracking/hypotheses.mjs";

await loadEnvFile();

const reportFile = resolve(process.env.REPORT_JSON_FILE ?? "reports/latest-report.json");
const hypothesesFile = resolve(process.env.HYPOTHESES_FILE ?? defaultHypothesesFile);
const force = process.argv.includes("--force");

const report = JSON.parse(await readFile(reportFile, "utf8"));
const existing = await readJsonLines(hypothesesFile);
const existingIds = new Set(existing.map((item) => item.id));
const rows = report.setupCandidates ?? [];
const hypotheses = rows
  .filter((row) => row.labels?.includes("Silent OI build") || row.labels?.includes("OI/MC watch") || row.labels?.includes("OI>MC"))
  .map((row) => buildHypothesis(row, { reportGeneratedAt: report.generatedAt }))
  .filter((hypothesis) => force || !existingIds.has(hypothesis.id));

await appendJsonLines(hypothesesFile, hypotheses);

console.log(`Hypotheses file: ${hypothesesFile}`);
console.log(`Report: ${reportFile}`);
console.log(`Candidates in report: ${rows.length}`);
console.log(`New hypotheses logged: ${hypotheses.length}`);

for (const hypothesis of hypotheses) {
  console.log(`${hypothesis.pair.padEnd(14)} | ${hypothesis.bias.padEnd(13)} | ${hypothesis.thesis}`);
  if (hypothesis.riskNote) console.log(`  Risk: ${hypothesis.riskNote}`);
}

if (!hypotheses.length && !force) {
  console.log("Nothing new to log. Use --force only if you intentionally want duplicates.");
}
