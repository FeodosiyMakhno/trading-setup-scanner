import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const defaultEvaluationFile = "reports/hypothesis-evaluation.json";

export async function readLatestEvaluation(file = process.env.HYPOTHESES_EVALUATION_FILE ?? defaultEvaluationFile) {
  const path = resolve(file);
  const content = await readFile(path, "utf8");
  return JSON.parse(content);
}
