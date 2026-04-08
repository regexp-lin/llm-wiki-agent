import fs from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT, LOG_FILE } from "./constants.js";

export async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
  console.log(`  wrote: ${path.relative(REPO_ROOT, filePath)}`);
}

export async function appendLog(entry: string): Promise<void> {
  const existing = await readFile(LOG_FILE);
  await fs.writeFile(LOG_FILE, entry.trim() + "\n\n" + existing, "utf-8");
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function getFileMtime(filePath: string): Promise<number> {
  const stat = await fs.stat(filePath);
  return stat.mtimeMs;
}
