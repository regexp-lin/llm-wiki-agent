#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import { ingestSingle, ingestBatch } from "../workflows/ingest.js";
import { loadIngestCache, clearIngestCache, getCacheStats, scanRawDirectory, classifyFile } from "../shared/ingest-cache.js";
import { REPO_ROOT } from "../shared/constants.js";

const program = new Command();
program
  .name("wiki-ingest")
  .description("Ingest source documents into the LLM Wiki")
  .argument("[source]", "Path to source document (omit to scan raw/ directory)")
  .option("--force", "Force re-ingest even if cached")
  .option("--dry-run", "Show what would be processed without actually doing it")
  .option("--clean", "Clear the ingest cache and exit")
  .option("--status", "Show cache status for all files and exit")
  .option("--concurrency <n>", "Number of parallel ingest workers (batch mode)", "1")
  .action(async (source: string | undefined, opts: {
    force?: boolean;
    dryRun?: boolean;
    clean?: boolean;
    status?: boolean;
    concurrency?: string;
  }) => {
    if (opts.clean) {
      await clearIngestCache();
      return;
    }

    if (opts.status) {
      await showStatus();
      return;
    }

    const concurrency = parseInt(opts.concurrency ?? "1", 10);

    if (source) {
      await ingestSingle(source, { force: opts.force ?? false });
    } else {
      await ingestBatch({
        force: opts.force ?? false,
        dryRun: opts.dryRun ?? false,
        concurrency,
      });
    }
  });

async function showStatus(): Promise<void> {
  const cache = await loadIngestCache();
  const stats = getCacheStats(cache);

  if (stats.total === 0) {
    console.log("Ingest cache is empty. No files have been processed.");
    return;
  }

  console.log(`\nIngest cache: ${stats.total} entries\n`);
  console.log("  Status  | Path                                    | Title");
  console.log("  --------|-----------------------------------------|------");

  const files = await scanRawDirectory();
  const fileSet = new Set(files.map((f) => path.relative(REPO_ROOT, f)));

  for (const { path: p, entry } of stats.entries) {
    const onDisk = fileSet.has(p);
    const diskStatus = onDisk ? "OK" : "DELETED";

    let liveStatus = diskStatus;
    if (onDisk) {
      const abs = path.join(REPO_ROOT, p);
      const candidate = await classifyFile(abs, cache, false);
      liveStatus = candidate.status;
    }

    console.log(`  ${liveStatus.padEnd(8)}| ${p.padEnd(40)}| ${entry.title}`);
  }

  const uncached = [...fileSet].filter((f) => !cache.entries[f]);
  if (uncached.length > 0) {
    console.log(`\n  Not cached (${uncached.length}):`);
    for (const f of uncached) {
      console.log(`    [NEW]     ${f}`);
    }
  }
}

program.parse();
