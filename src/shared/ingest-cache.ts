import fs from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT, RAW_DIR, INGEST_CACHE_FILE, WIKI_DIR, SUPPORTED_EXTENSIONS } from "./constants.js";
import { fileExists } from "./file-utils.js";
import { sha256Short } from "./crypto-utils.js";
import type { IngestCache, IngestCacheEntry, IngestCandidate, IngestFileStatus } from "./types.js";

const CACHE_VERSION = 1;

/** @deprecated Use sha256Short from crypto-utils instead */
export const sha256 = sha256Short;

export async function loadIngestCache(): Promise<IngestCache> {
  try {
    const raw = await fs.readFile(INGEST_CACHE_FILE, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("version" in parsed) ||
      !("entries" in parsed) ||
      typeof (parsed as Record<string, unknown>).entries !== "object"
    ) {
      console.log("  warning: cache file corrupted, starting fresh");
      return { version: CACHE_VERSION, entries: {} };
    }
    const cache = parsed as IngestCache;
    if (cache.version !== CACHE_VERSION) {
      console.log("  warning: cache version mismatch, starting fresh");
      return { version: CACHE_VERSION, entries: {} };
    }
    return cache;
  } catch {
    return { version: CACHE_VERSION, entries: {} };
  }
}

export async function saveIngestCache(cache: IngestCache): Promise<void> {
  await fs.mkdir(path.dirname(INGEST_CACHE_FILE), { recursive: true });
  const tmpFile = INGEST_CACHE_FILE + `.tmp.${process.pid}.${Date.now()}`;
  try {
    await fs.writeFile(tmpFile, JSON.stringify(cache, null, 2), "utf-8");
    await fs.rename(tmpFile, INGEST_CACHE_FILE);
  } catch (error) {
    try { await fs.unlink(tmpFile); } catch { /* ignore cleanup */ }
    throw error;
  }
}

export async function clearIngestCache(): Promise<void> {
  try {
    await fs.unlink(INGEST_CACHE_FILE);
    console.log("Ingest cache cleared.");
  } catch {
    console.log("No ingest cache to clear.");
  }
}

export async function scanRawDirectory(): Promise<string[]> {
  try {
    const results: string[] = [];
    async function walk(dir: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
          results.push(full);
        }
      }
    }
    await walk(RAW_DIR);
    return results.sort();
  } catch {
    return [];
  }
}

export async function classifyFile(
  absolutePath: string,
  cache: IngestCache,
  force: boolean,
): Promise<IngestCandidate> {
  const relativePath = path.relative(REPO_ROOT, absolutePath);
  const content = await fs.readFile(absolutePath, "utf-8");
  const currentHash = sha256Short(content);

  if (force) {
    return { relativePath, absolutePath, status: "FORCED", contentHash: currentHash, cachedEntry: cache.entries[relativePath] };
  }

  const cached = cache.entries[relativePath];
  if (!cached) {
    return { relativePath, absolutePath, status: "NEW", contentHash: currentHash };
  }

  if (cached.content_hash !== currentHash) {
    return { relativePath, absolutePath, status: "CHANGED", contentHash: currentHash, cachedEntry: cached };
  }

  const outputPath = path.join(WIKI_DIR, "sources", `${cached.slug}.md`);
  if (!(await fileExists(outputPath))) {
    return { relativePath, absolutePath, status: "OUTPUT_MISSING", contentHash: currentHash, cachedEntry: cached };
  }

  return { relativePath, absolutePath, status: "CACHED", contentHash: currentHash, cachedEntry: cached };
}

export function updateCacheEntry(
  cache: IngestCache,
  relativePath: string,
  contentHash: string,
  slug: string,
  title: string,
): void {
  cache.entries[relativePath] = {
    content_hash: contentHash,
    slug,
    source_page: `wiki/sources/${slug}.md`,
    ingested_at: new Date().toISOString(),
    title,
  };
}

export function removeStaleCacheEntries(cache: IngestCache, existingFiles: Set<string>): number {
  let removed = 0;
  for (const key of Object.keys(cache.entries)) {
    if (!existingFiles.has(key)) {
      delete cache.entries[key];
      removed++;
    }
  }
  return removed;
}

export function getCacheStats(cache: IngestCache): {
  total: number;
  entries: Array<{ path: string; entry: IngestCacheEntry }>;
} {
  const entries = Object.entries(cache.entries).map(([p, entry]) => ({
    path: p,
    entry,
  }));
  return { total: entries.length, entries };
}

export function formatStatus(status: IngestFileStatus): string {
  const labels: Record<IngestFileStatus, string> = {
    NEW: "+NEW",
    CHANGED: "~CHANGED",
    OUTPUT_MISSING: "!OUTPUT_MISSING",
    CACHED: "=CACHED",
    FORCED: "FORCED",
  };
  return `[${labels[status]}]`;
}
