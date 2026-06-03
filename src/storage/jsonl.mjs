import { mkdir, readFile, appendFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function appendJsonLines(filePath, records) {
  if (records.length === 0) return;
  await mkdir(dirname(filePath), { recursive: true });
  const lines = records.map((record) => JSON.stringify(record)).join("\n");
  await appendFile(filePath, `${lines}\n`, "utf8");
}

export async function readJsonLines(filePath) {
  let text;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
