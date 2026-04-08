import fs from "node:fs/promises";
import path from "node:path";

import {
  REPO_ROOT,
  WIKI_DIR,
  INDEX_FILE,
  SCHEMA_FILE,
  MODEL_SONNET,
  MODEL_HAIKU,
} from "../shared/constants.js";
import { readFile, writeFile, appendLog } from "../shared/file-utils.js";
import { getClient, parseJsonArrayFromResponse } from "../shared/llm-utils.js";
import type { QueryOptions } from "../shared/types.js";

export function findRelevantPages(
  question: string,
  indexContent: string,
): { title: string; href: string }[] {
  const mdLinks = [...indexContent.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map((m) => ({
    title: m[1]!,
    href: m[2]!,
  }));

  const questionLower = question.toLowerCase();
  const relevant: { title: string; href: string }[] = [];

  for (const { title, href } of mdLinks) {
    const words = title.toLowerCase().split(/\s+/);
    if (words.some((w) => w.length > 3 && questionLower.includes(w))) {
      relevant.push({ title, href });
    }
  }

  // Always include overview
  const hasOverview = relevant.some((r) => r.href === "overview.md");
  if (!hasOverview) {
    relevant.unshift({ title: "Overview", href: "overview.md" });
  }

  return relevant.slice(0, 12);
}

export async function query(options: QueryOptions): Promise<string> {
  const { question, savePath } = options;
  const today = new Date().toISOString().slice(0, 10);
  const client = getClient();

  // Step 1: Read index
  const indexContent = await readFile(INDEX_FILE);
  if (!indexContent) {
    console.log("Wiki is empty. Ingest some sources first with: pnpm dev:ingest <source>");
    process.exit(1);
  }

  // Step 2: Find relevant pages
  let relevantPages = findRelevantPages(question, indexContent);

  // If no keyword match, ask Claude to identify relevant pages from the index
  if (relevantPages.length <= 1) {
    console.log("  selecting relevant pages via Claude...");
    const selectionResponse = await client.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Given this wiki index:\n\n${indexContent}\n\nWhich pages are most relevant to answering: "${question}"\n\nReturn ONLY a JSON array of relative file paths (as listed in the index), e.g. ["sources/foo.md", "concepts/Bar.md"]. Maximum 10 pages.`,
        },
      ],
    });

    const firstBlock = selectionResponse.content[0];
    if (firstBlock?.type === "text") {
      try {
        const paths = parseJsonArrayFromResponse(firstBlock.text) as string[];
        const resolved = paths
          .filter((p): p is string => typeof p === "string")
          .map((p) => ({ title: path.basename(p, ".md"), href: p }));
        if (resolved.length > 0) {
          relevantPages = resolved;
        }
      } catch {
        // fall through to use whatever we have
      }
    }
  }

  // Step 3: Read relevant pages
  let pagesContext = "";
  const validPages: string[] = [];

  for (const { href } of relevantPages) {
    const fullPath = path.join(WIKI_DIR, href);
    try {
      const content = await fs.readFile(fullPath, "utf-8");
      const rel = path.relative(REPO_ROOT, fullPath);
      pagesContext += `\n\n### ${rel}\n${content}`;
      validPages.push(fullPath);
    } catch {
      // file doesn't exist, skip
    }
  }

  if (!pagesContext) {
    pagesContext = `\n\n### wiki/index.md\n${indexContent}`;
  }

  const schema = await readFile(SCHEMA_FILE);

  // Step 4: Synthesize answer
  console.log(`  synthesizing answer from ${validPages.length} pages...`);
  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are querying an LLM Wiki to answer a question. Use the wiki pages below to synthesize a thorough answer. Cite sources using [[PageName]] wikilink syntax.

Schema:
${schema}

Wiki pages:
${pagesContext}

Question: ${question}

Write a well-structured markdown answer with headers, bullets, and [[wikilink]] citations. At the end, add a ## Sources section listing the pages you drew from.
`,
      },
    ],
  });

  const firstBlock = response.content[0];
  const answer = firstBlock?.type === "text" ? firstBlock.text : "";

  console.log("\n" + "=".repeat(60));
  console.log(answer);
  console.log("=".repeat(60));

  // Step 5: Optionally save answer
  const actualSavePath = savePath;
  if (actualSavePath !== undefined) {
    if (actualSavePath === "") {
      // In CLI context, commander handles this; for programmatic use, skip save
      console.log("Skipping save (no path provided).");
      return answer;
    }

    const fullSavePath = path.join(WIKI_DIR, actualSavePath);
    const frontmatter = `---
title: "${question.slice(0, 80)}"
type: synthesis
tags: []
sources: []
last_updated: ${today}
---

`;
    await writeFile(fullSavePath, frontmatter + answer);

    // Update index
    let idxContent = await readFile(INDEX_FILE);
    const entry = `- [${question.slice(0, 60)}](${actualSavePath}) — synthesis`;
    if (idxContent.includes("## Syntheses")) {
      idxContent = idxContent.replace("## Syntheses\n", `## Syntheses\n${entry}\n`);
      await fs.writeFile(INDEX_FILE, idxContent, "utf-8");
    }
    console.log(`  indexed: ${actualSavePath}`);
  }

  // Append to log
  await appendLog(
    `## [${today}] query | ${question.slice(0, 80)}\n\nSynthesized answer from ${validPages.length} pages.` +
      (actualSavePath ? ` Saved to ${actualSavePath}.` : ""),
  );

  return answer;
}
