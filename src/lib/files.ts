import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

export async function ensureParentDir(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await ensureParentDir(filePath);
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function writeText(filePath: string, value: string): Promise<void> {
  await ensureParentDir(filePath);
  await writeFile(filePath, value, "utf8");
}

export async function resetSymlink(linkPath: string, targetPath: string): Promise<void> {
  await rm(linkPath, { force: true, recursive: true });
  await symlink(path.resolve(targetPath), linkPath, "dir");
}
