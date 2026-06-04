import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const defaultReportFile = "reports/latest-report.json";

export async function readLatestReport(file = process.env.REPORT_JSON_FILE ?? defaultReportFile) {
  const path = resolve(file);
  const content = await readFile(path, "utf8");
  return JSON.parse(content);
}
