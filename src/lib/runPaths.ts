import { readdir } from "node:fs/promises";
import path from "node:path";
import type { VisualConfig } from "../types.js";
import { ensureDir, resetSymlink, writeText } from "./files.js";
import { slugifyPath } from "./patterns.js";

export async function createRunDir(config: VisualConfig): Promise<string> {
  if (config.runDir) {
    await ensureDir(config.runDir);
    return config.runDir;
  }

  const date = new Date().toISOString().slice(0, 10);
  const dateDir = path.join(config.outputDir, date);
  await ensureDir(dateDir);

  const entries = await readdir(dateDir, { withFileTypes: true }).catch(() => []);
  const lastRunNumber = entries
    .filter((entry) => entry.isDirectory() && /^run-\d+$/.test(entry.name))
    .map((entry) => Number(entry.name.replace("run-", "")))
    .reduce((max, value) => Math.max(max, value), 0);

  const runDir = path.join(dateDir, `run-${String(lastRunNumber + 1).padStart(3, "0")}`);
  await ensureDir(runDir);
  return runDir;
}

export async function updateLatestPointer(outputDir: string, runDir: string): Promise<void> {
  await ensureDir(outputDir);
  const latestPath = path.join(outputDir, "latest");

  try {
    await resetSymlink(latestPath, runDir);
  } catch {
    await writeText(path.join(outputDir, "latest.txt"), path.resolve(runDir));
  }
}

export function comparisonDir(runDir: string, pagePath: string, viewportName: string): string {
  return path.join(runDir, slugifyPath(pagePath), viewportName);
}
