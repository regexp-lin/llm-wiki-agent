import fs from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT, LOG_FILE } from "./constants.js";
import { WikiError, WikiErrorCode } from "./errors.js";

export async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw new WikiError(
      `Failed to read ${filePath}: ${(error as Error).message}`,
      WikiErrorCode.FILE_PERMISSION,
      { filePath, originalError: error },
    );
  }
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpFile = filePath + `.tmp.${process.pid}.${Date.now()}`;
  try {
    await fs.writeFile(tmpFile, content, "utf-8");
    await fs.rename(tmpFile, filePath);
  } catch (error) {
    try {
      await fs.unlink(tmpFile);
    } catch {
      // ignore cleanup failure
    }
    throw error;
  }
  console.log(`  wrote: ${path.relative(REPO_ROOT, filePath)}`);
}

export async function appendLog(entry: string): Promise<void> {
  const existing = await readFile(LOG_FILE);
  const tmpFile = LOG_FILE + `.tmp.${process.pid}.${Date.now()}`;
  const content = entry.trim() + "\n\n" + existing;
  try {
    await fs.writeFile(tmpFile, content, "utf-8");
    await fs.rename(tmpFile, LOG_FILE);
  } catch (error) {
    try {
      await fs.unlink(tmpFile);
    } catch {
      // ignore cleanup failure
    }
    throw error;
  }
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

export async function readFilesParallel(
  paths: string[],
  concurrency = 20,
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  for (let i = 0; i < paths.length; i += concurrency) {
    const batch = paths.slice(i, i + concurrency);
    const contents = await Promise.all(
      batch.map(async (p) => ({
        path: p,
        content: await readFile(p),
      })),
    );
    for (const { path: p, content } of contents) {
      results.set(p, content);
    }
  }

  return results;
}
