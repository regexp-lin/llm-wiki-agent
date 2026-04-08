import crypto from "node:crypto";
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
import { getClient, parseJsonFromResponse } from "../shared/llm-utils.js";
import type { IngestResult, PageUpdate } from "../shared/types.js";

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

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

    for (const { fullPath } of recent) {
      const content = await fs.readFile(fullPath, "utf-8");
      parts.push(`## ${path.relative(REPO_ROOT, fullPath)}\n${content}`);
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

function isIngestResult(data: unknown): data is IngestResult {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return typeof d.slug === "string" && typeof d.source_page === "string";
}

export async function ingest(sourcePath: string): Promise<void> {
  const resolvedPath = path.resolve(sourcePath);

  try {
    await fs.access(resolvedPath);
  } catch {
    console.log(`Error: file not found: ${sourcePath}`);
    process.exit(1);
  }

  const sourceContent = await fs.readFile(resolvedPath, "utf-8");
  const sourceHash = sha256(sourceContent);
  const today = new Date().toISOString().slice(0, 10);

  const sourceName = path.basename(resolvedPath);
  console.log(`\nIngesting: ${sourceName}  (hash: ${sourceHash})`);

  const wikiContext = await buildWikiContext();
  const schema = await readFile(SCHEMA_FILE);

  const relPath = resolvedPath.startsWith(REPO_ROOT)
    ? path.relative(REPO_ROOT, resolvedPath)
    : sourceName;

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
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const firstBlock = response.content[0];
  if (!firstBlock || firstBlock.type !== "text") {
    console.log("Error: unexpected API response format");
    process.exit(1);
  }
  const raw = firstBlock.text;

  let data: IngestResult;
  try {
    const parsed = parseJsonFromResponse(raw);
    if (!isIngestResult(parsed)) {
      throw new Error("Response missing required fields");
    }
    data = parsed;
  } catch (e) {
    console.log(`Error parsing API response: ${e instanceof Error ? e.message : e}`);
    const debugDir = path.join(REPO_ROOT, ".debug");
    await fs.mkdir(debugDir, { recursive: true });
    const debugPath = path.join(debugDir, "ingest_debug.txt");
    await fs.writeFile(debugPath, raw, "utf-8");
    console.log(`Raw response saved to ${path.relative(REPO_ROOT, debugPath)}`);
    process.exit(1);
  }

  // Write source page
  await writeFile(path.join(WIKI_DIR, "sources", `${data.slug}.md`), data.source_page);

  // Write entity pages
  for (const page of data.entity_pages ?? []) {
    await writeFile(path.join(WIKI_DIR, (page as PageUpdate).path), (page as PageUpdate).content);
  }

  // Write concept pages
  for (const page of data.concept_pages ?? []) {
    await writeFile(path.join(WIKI_DIR, (page as PageUpdate).path), (page as PageUpdate).content);
  }

  // Update overview
  if (data.overview_update) {
    await writeFile(OVERVIEW_FILE, data.overview_update);
  }

  // Update index
  await updateIndex(data.index_entry, "Sources");

  // Append log
  await appendLog(data.log_entry);

  // Report contradictions
  const contradictions = data.contradictions ?? [];
  if (contradictions.length > 0) {
    console.log("\n  ⚠️  Contradictions detected:");
    for (const c of contradictions) {
      console.log(`     - ${c}`);
    }
  }

  console.log(`\nDone. Ingested: ${data.title}`);
}
