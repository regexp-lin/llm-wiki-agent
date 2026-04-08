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
import { callLlm, parseJsonArrayFromResponse } from "../shared/llm-utils.js";
import { PageSelectionSchema } from "../shared/validators.js";
import { fitPagesIntoBudget } from "../shared/context-manager.js";
import { WikiError, WikiErrorCode } from "../shared/errors.js";
import { usageTracker } from "../shared/usage-tracker.js";
import type { QueryOptions } from "../shared/types.js";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[\s\-_/.,;:!?()[\]{}]+/)
    .filter((w) => w.length > 0);
}

export function findRelevantPages(
  question: string,
  indexContent: string,
): { title: string; href: string; score: number }[] {
  const mdLinks = [...indexContent.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map((m) => ({
    title: m[1]!,
    href: m[2]!,
  }));

  const questionTokens = tokenize(question);

  const scored = mdLinks.map(({ title, href }) => {
    const titleTokens = tokenize(title);
    let score = 0;

    for (const qt of questionTokens) {
      for (const tt of titleTokens) {
        if (qt === tt) score += 3;
        else if (qt.includes(tt) || tt.includes(qt)) score += 1;
      }
    }

    if (question.toLowerCase().includes(title.toLowerCase())) {
      score += 5;
    }

    return { title, href, score };
  });

  const relevant = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  const hasOverview = relevant.some((r) => r.href === "overview.md");
  if (!hasOverview) {
    relevant.unshift({ title: "Overview", href: "overview.md", score: Infinity });
  }

  return relevant;
}

export async function query(options: QueryOptions): Promise<string> {
  const { question, savePath } = options;
  const today = new Date().toISOString().slice(0, 10);

  const indexContent = await readFile(INDEX_FILE);
  if (!indexContent) {
    throw new WikiError(
      "Wiki is empty. Ingest some sources first.",
      WikiErrorCode.WIKI_EMPTY,
    );
  }

  let relevantPages = findRelevantPages(question, indexContent);

  if (relevantPages.length <= 1) {
    console.log("  selecting relevant pages via Claude...");
    const selectionResponse = await callLlm(
      {
        model: MODEL_HAIKU,
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: `Given this wiki index:\n\n${indexContent}\n\nWhich pages are most relevant to answering: "${question}"\n\nReturn ONLY a JSON array of relative file paths (as listed in the index), e.g. ["sources/foo.md", "concepts/Bar.md"]. Maximum 10 pages.`,
          },
        ],
      },
      { workflow: "query" },
    );

    const firstBlock = selectionResponse.content[0];
    if (firstBlock?.type === "text") {
      try {
        const rawPaths = parseJsonArrayFromResponse(firstBlock.text);
        const parsed = PageSelectionSchema.safeParse(rawPaths);
        const paths = parsed.success ? parsed.data : [];
        const resolved = paths
          .map((p) => ({ title: path.basename(p, ".md"), href: p, score: 1 }));
        if (resolved.length > 0) {
          relevantPages = resolved;
        }
      } catch {
        // fall through to use whatever we have
      }
    }
  }

  const pageContents: { path: string; content: string }[] = [];
  for (const { href } of relevantPages) {
    const fullPath = path.join(WIKI_DIR, href);
    const content = await readFile(fullPath);
    if (content) {
      pageContents.push({
        path: path.relative(REPO_ROOT, fullPath),
        content,
      });
    }
  }

  const fitted = fitPagesIntoBudget(pageContents);

  let pagesContext = "";
  for (const page of fitted) {
    pagesContext += `\n\n### ${page.path}\n${page.content}`;
  }

  if (!pagesContext) {
    pagesContext = `\n\n### wiki/index.md\n${indexContent}`;
  }

  const schema = await readFile(SCHEMA_FILE);

  console.log(`  synthesizing answer from ${fitted.length} pages...`);
  const response = await callLlm(
    {
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
    },
    { workflow: "query" },
  );

  const firstBlock = response.content[0];
  const answer = firstBlock?.type === "text" ? firstBlock.text : "";

  console.log("\n" + "=".repeat(60));
  console.log(answer);
  console.log("=".repeat(60));

  let actualSavePath = savePath;
  if (actualSavePath === "") {
    actualSavePath = `syntheses/${slugify(question.slice(0, 60))}.md`;
  }

  if (actualSavePath !== undefined) {
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

    let idxContent = await readFile(INDEX_FILE);
    const entry = `- [${question.slice(0, 60)}](${actualSavePath}) — synthesis`;
    if (idxContent.includes("## Syntheses")) {
      idxContent = idxContent.replace("## Syntheses\n", `## Syntheses\n${entry}\n`);
      await writeFile(INDEX_FILE, idxContent);
    }
    console.log(`  indexed: ${actualSavePath}`);
  }

  await appendLog(
    `## [${today}] query | ${question.slice(0, 80)}\n\nSynthesized answer from ${fitted.length} pages.` +
      (actualSavePath ? ` Saved to ${actualSavePath}.` : ""),
  );

  usageTracker.printSummary();

  return answer;
}
