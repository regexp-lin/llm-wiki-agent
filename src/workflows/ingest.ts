import fs from "node:fs/promises";
import path from "node:path";

import {
  REPO_ROOT,
  WIKI_DIR,
  INDEX_FILE,
  OVERVIEW_FILE,
  SCHEMA_FILE,
  INDEX_TEMPLATE,
  MODEL_SONNET,
} from "../shared/constants.js";
import { readFile, writeFile, appendLog } from "../shared/file-utils.js";
import { callLlm, parseJsonFromResponse } from "../shared/llm-utils.js";
import { sha256Short } from "../shared/crypto-utils.js";
import {
  loadIngestCache,
  saveIngestCache,
  scanRawDirectory,
  classifyFile,
  updateCacheEntry,
  removeStaleCacheEntries,
  formatStatus,
} from "../shared/ingest-cache.js";
import { IngestResultSchema } from "../shared/validators.js";
import { fitPagesIntoBudget } from "../shared/context-manager.js";
import { Semaphore } from "../shared/semaphore.js";
import { ProgressTracker } from "../shared/progress.js";
import { WikiError, WikiErrorCode } from "../shared/errors.js";
import { usageTracker } from "../shared/usage-tracker.js";
import type { IngestResult, IngestCache, IngestBatchOptions } from "../shared/types.js";

async function buildWikiContext(): Promise<string> {
  const parts: string[] = [];

  const indexContent = await readFile(INDEX_FILE);
  if (indexContent) {
    parts.push(`## wiki/index.md\n${indexContent}`);
  }

  const overviewContent = await readFile(OVERVIEW_FILE);
  if (overviewContent) {
    parts.push(`## wiki/overview.md\n${overviewContent}`);
  }

  const sourcesDir = path.join(WIKI_DIR, "sources");
  try {
    const entries = await fs.readdir(sourcesDir);
    const mdFiles = entries.filter((e) => e.endsWith(".md"));

    const withMtime = await Promise.all(
      mdFiles.map(async (name) => {
        const fullPath = path.join(sourcesDir, name);
        const stat = await fs.stat(fullPath);
        return { name, fullPath, mtime: stat.mtimeMs };
      }),
    );

    withMtime.sort((a, b) => b.mtime - a.mtime);
    const recent = withMtime.slice(0, 5);

    const recentPages = await Promise.all(
      recent.map(async ({ fullPath }) => ({
        path: path.relative(REPO_ROOT, fullPath),
        content: await fs.readFile(fullPath, "utf-8"),
      })),
    );

    const fitted = fitPagesIntoBudget(recentPages, {
      maxTotalTokens: 40000,
      reservedForOutput: 0,
      reservedForPromptFrame: 0,
    });

    for (const page of fitted) {
      parts.push(`## ${page.path}\n${page.content}`);
    }
  } catch {
    // sources/ dir may not exist yet
  }

  return parts.join("\n\n---\n\n");
}

async function updateIndex(newEntry: string, section: string = "Sources"): Promise<void> {
  let content = await readFile(INDEX_FILE);
  if (!content) {
    content = INDEX_TEMPLATE;
  }

  const sectionHeader = `## ${section}`;
  if (content.includes(sectionHeader)) {
    content = content.replace(sectionHeader + "\n", sectionHeader + "\n" + newEntry + "\n");
  } else {
    content += `\n${sectionHeader}\n${newEntry}\n`;
  }

  await writeFile(INDEX_FILE, content);
}

interface WriteOperation {
  path: string;
  content: string;
}

class IngestTransaction {
  private writes: WriteOperation[] = [];
  private backups: Map<string, string | null> = new Map();

  record(filePath: string, content: string): void {
    this.writes.push({ path: filePath, content });
  }

  async commit(): Promise<void> {
    for (const { path: filePath } of this.writes) {
      try {
        const existing = await fs.readFile(filePath, "utf-8");
        this.backups.set(filePath, existing);
      } catch {
        this.backups.set(filePath, null);
      }
    }

    try {
      for (const { path: filePath, content } of this.writes) {
        await writeFile(filePath, content);
      }
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  private async rollback(): Promise<void> {
    for (const [filePath, backup] of this.backups) {
      try {
        if (backup === null) {
          await fs.unlink(filePath);
        } else {
          await fs.writeFile(filePath, backup, "utf-8");
        }
      } catch {
        // best-effort rollback
      }
    }
  }
}

async function ingestSingleInternal(
  absolutePath: string,
  cache: IngestCache,
  precomputedHash?: string,
): Promise<{ slug: string; title: string; contentHash: string } | null> {
  const sourceContent = await fs.readFile(absolutePath, "utf-8");
  const sourceHash = precomputedHash ?? sha256Short(sourceContent);
  const today = new Date().toISOString().slice(0, 10);
  const sourceName = path.basename(absolutePath);
  const relPath = absolutePath.startsWith(REPO_ROOT)
    ? path.relative(REPO_ROOT, absolutePath)
    : sourceName;

  console.log(`\nIngesting: ${sourceName}  (hash: ${sourceHash})`);

  const wikiContext = await buildWikiContext();
  const schema = await readFile(SCHEMA_FILE);

  const prompt = `You are maintaining an LLM Wiki. Process this source document and integrate its knowledge into the wiki.

Schema and conventions:
${schema}

Current wiki state (index + recent pages):
${wikiContext || "(wiki is empty — this is the first source)"}

New source to ingest (file: ${relPath}):
=== SOURCE START ===
${sourceContent}
=== SOURCE END ===

Today's date: ${today}

Return ONLY a valid JSON object with these fields (no markdown fences, no prose outside the JSON):
{
  "title": "Human-readable title for this source",
  "slug": "kebab-case-slug-for-filename",
  "source_page": "full markdown content for wiki/sources/<slug>.md — use the source page format from the schema",
  "index_entry": "- [Title](sources/slug.md) — one-line summary",
  "overview_update": "full updated content for wiki/overview.md, or null if no update needed",
  "entity_pages": [
    {"path": "entities/EntityName.md", "content": "full markdown content"}
  ],
  "concept_pages": [
    {"path": "concepts/ConceptName.md", "content": "full markdown content"}
  ],
  "contradictions": ["describe any contradiction with existing wiki content, or empty list"],
  "log_entry": "## [${today}] ingest | <title>\\n\\nAdded source. Key claims: ..."
}`;

  console.log("  calling Claude API...");

  const response = await callLlm(
    {
      model: MODEL_SONNET,
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    },
    { workflow: "ingest" },
  );

  const firstBlock = response.content[0];
  if (!firstBlock || firstBlock.type !== "text") {
    console.log("Error: unexpected API response format");
    return null;
  }
  const raw = firstBlock.text;

  let data: IngestResult;
  try {
    const parsed = parseJsonFromResponse(raw);
    const validationResult = IngestResultSchema.safeParse(parsed);
    if (!validationResult.success) {
      throw new Error(`Validation error: ${validationResult.error.message}`);
    }
    data = validationResult.data;
  } catch (e) {
    console.log(`Error parsing API response: ${e instanceof Error ? e.message : e}`);
    const debugDir = path.join(REPO_ROOT, ".debug");
    await fs.mkdir(debugDir, { recursive: true });
    const debugPath = path.join(debugDir, "ingest_debug.txt");
    await fs.writeFile(debugPath, raw, "utf-8");
    console.log(`Raw response saved to ${path.relative(REPO_ROOT, debugPath)}`);
    return null;
  }

  const tx = new IngestTransaction();
  tx.record(path.join(WIKI_DIR, "sources", `${data.slug}.md`), data.source_page);

  for (const page of data.entity_pages) {
    tx.record(path.join(WIKI_DIR, page.path), page.content);
  }
  for (const page of data.concept_pages) {
    tx.record(path.join(WIKI_DIR, page.path), page.content);
  }
  if (data.overview_update) {
    tx.record(OVERVIEW_FILE, data.overview_update);
  }

  await tx.commit();

  await updateIndex(data.index_entry, "Sources");
  await appendLog(data.log_entry);

  if (data.contradictions.length > 0) {
    console.log("\n  Contradictions detected:");
    for (const c of data.contradictions) {
      console.log(`     - ${c}`);
    }
  }

  const relativePath = path.relative(REPO_ROOT, absolutePath);
  updateCacheEntry(cache, relativePath, sourceHash, data.slug, data.title);

  console.log(`Done. Ingested: ${data.title}`);
  return { slug: data.slug, title: data.title, contentHash: sourceHash };
}

export async function ingestSingle(sourcePath: string, opts?: { force?: boolean }): Promise<void> {
  const resolvedPath = path.resolve(sourcePath);
  const force = opts?.force ?? false;

  try {
    await fs.access(resolvedPath);
  } catch {
    throw new WikiError(
      `File not found: ${sourcePath}`,
      WikiErrorCode.FILE_NOT_FOUND,
      { sourcePath },
    );
  }

  const cache = await loadIngestCache();
  const candidate = await classifyFile(resolvedPath, cache, force);

  if (candidate.status === "CACHED") {
    console.log(`Skipped (cached): ${candidate.relativePath}`);
    return;
  }

  console.log(`${formatStatus(candidate.status)} ${candidate.relativePath}`);

  const result = await ingestSingleInternal(resolvedPath, cache, candidate.contentHash);
  if (result) {
    await saveIngestCache(cache);
  }

  usageTracker.printSummary();
}

export async function ingestBatch(opts?: IngestBatchOptions): Promise<void> {
  const force = opts?.force ?? false;
  const dryRun = opts?.dryRun ?? false;
  const concurrency = opts?.concurrency ?? 1;

  const files = await scanRawDirectory();
  if (files.length === 0) {
    console.log("No supported files found in raw/ directory.");
    return;
  }

  const cache = await loadIngestCache();

  const existingRelPaths = new Set(files.map((f) => path.relative(REPO_ROOT, f)));
  const staleRemoved = removeStaleCacheEntries(cache, existingRelPaths);
  if (staleRemoved > 0) {
    console.log(`  Removed ${staleRemoved} stale cache entries (source files deleted).`);
  }

  const candidates = await Promise.all(
    files.map((f) => classifyFile(f, cache, force)),
  );

  const toProcess = candidates.filter((c) => c.status !== "CACHED");
  const skipped = candidates.filter((c) => c.status === "CACHED");

  console.log(`\nScan complete: ${files.length} files found`);
  console.log(`  To process: ${toProcess.length}`);
  console.log(`  Skipped:    ${skipped.length}`);
  if (toProcess.length > 0) {
    for (const c of toProcess) {
      console.log(`    ${formatStatus(c.status)} ${c.relativePath}`);
    }
  }

  if (dryRun) {
    console.log("\n--dry-run: no files were processed.");
    return;
  }

  if (toProcess.length === 0) {
    console.log("\nAll files are up to date. Nothing to do.");
    return;
  }

  let processed = 0;
  let failed = 0;

  const apiSemaphore = new Semaphore(concurrency);
  const ioMutex = new Semaphore(1);
  const progress = new ProgressTracker(toProcess.length, "ingest");

  const results = await Promise.allSettled(
    toProcess.map(async (c) => {
      await apiSemaphore.acquire();
      try {
        const result = await ingestSingleInternal(c.absolutePath, cache, c.contentHash);

        await ioMutex.acquire();
        try {
          if (result) {
            processed++;
            await saveIngestCache(cache);
          } else {
            failed++;
          }
          progress.tick(c.relativePath);
        } finally {
          ioMutex.release();
        }
      } catch (err) {
        await ioMutex.acquire();
        try {
          failed++;
          progress.tick(`FAILED: ${c.relativePath}`);
        } finally {
          ioMutex.release();
        }
        console.log(`  Error processing ${c.relativePath}: ${err instanceof Error ? err.message : err}`);
      } finally {
        apiSemaphore.release();
      }
    }),
  );

  // Check for unhandled rejections
  for (const result of results) {
    if (result.status === "rejected") {
      console.log(`  Unexpected error: ${result.reason}`);
    }
  }

  await saveIngestCache(cache);

  console.log(`\nBatch complete. Processed: ${processed}, Failed: ${failed}, Skipped: ${skipped.length}`);
  usageTracker.printSummary();
}

/** @deprecated Use ingestSingle instead */
export const ingest = ingestSingle;
