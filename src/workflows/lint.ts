import path from "node:path";

import { REPO_ROOT, WIKI_DIR, OVERVIEW_FILE, MODEL_SONNET } from "../shared/constants.js";
import { writeFile, appendLog, readFilesParallel } from "../shared/file-utils.js";
import { allWikiPages, extractWikilinks, buildPageNameMap } from "../shared/wiki-utils.js";
import { callLlm } from "../shared/llm-utils.js";
import { usageTracker } from "../shared/usage-tracker.js";
import type { BrokenLink } from "../shared/types.js";

export function findOrphans(
  pages: string[],
  contents: Map<string, string>,
  nameMap: Map<string, string[]>,
): string[] {
  const inbound = new Map<string, number>();

  for (const p of pages) {
    inbound.set(p, inbound.get(p) ?? 0);
  }

  for (const p of pages) {
    const content = contents.get(p) ?? "";
    const links = extractWikilinks(content);
    for (const link of links) {
      const resolved = nameMap.get(link.toLowerCase()) ?? [];
      for (const r of resolved) {
        inbound.set(r, (inbound.get(r) ?? 0) + 1);
      }
    }
  }

  return pages.filter(
    (p) => (inbound.get(p) ?? 0) === 0 && path.resolve(p) !== path.resolve(OVERVIEW_FILE),
  );
}

export function findBrokenLinks(
  pages: string[],
  contents: Map<string, string>,
  nameMap: Map<string, string[]>,
): BrokenLink[] {
  const broken: BrokenLink[] = [];

  for (const p of pages) {
    const content = contents.get(p) ?? "";
    const links = extractWikilinks(content);
    for (const link of links) {
      const resolved = nameMap.get(link.toLowerCase());
      if (!resolved || resolved.length === 0) {
        broken.push({
          sourcePage: path.relative(REPO_ROOT, p),
          targetLink: link,
        });
      }
    }
  }

  return broken;
}

export function findMissingEntities(
  pages: string[],
  contents: Map<string, string>,
  nameMap: Map<string, string[]>,
): string[] {
  const mentionCounts = new Map<string, number>();
  const existingPages = new Set([...nameMap.keys()]);

  for (const p of pages) {
    const content = contents.get(p) ?? "";
    const links = extractWikilinks(content);
    for (const link of links) {
      if (!existingPages.has(link.toLowerCase())) {
        mentionCounts.set(link, (mentionCounts.get(link) ?? 0) + 1);
      }
    }
  }

  return [...mentionCounts.entries()].filter(([, count]) => count >= 3).map(([name]) => name);
}

export async function runLint(save?: boolean): Promise<string> {
  const pages = await allWikiPages();
  const today = new Date().toISOString().slice(0, 10);

  if (pages.length === 0) {
    console.log("Wiki is empty. Nothing to lint.");
    return "";
  }

  console.log(`Linting ${pages.length} wiki pages...`);

  const contents = await readFilesParallel(pages);
  const nameMap = await buildPageNameMap(pages);

  const orphans = findOrphans(pages, contents, nameMap);
  const broken = findBrokenLinks(pages, contents, nameMap);
  const missingEntities = findMissingEntities(pages, contents, nameMap);

  console.log(`  orphans: ${orphans.length}`);
  console.log(`  broken links: ${broken.length}`);
  console.log(`  missing entity pages: ${missingEntities.length}`);

  const sample = pages.slice(0, 20);
  let pagesContext = "";
  for (const p of sample) {
    const rel = path.relative(REPO_ROOT, p);
    const content = contents.get(p) ?? "";
    pagesContext += `\n\n### ${rel}\n${content.slice(0, 1500)}`;
  }

  console.log("  running semantic lint via Claude API...");

  const response = await callLlm(
    {
      model: MODEL_SONNET,
      max_tokens: 3000,
      messages: [
        {
          role: "user",
          content: `You are linting an LLM Wiki. Review the pages below and identify:
1. Contradictions between pages (claims that conflict)
2. Stale content (summaries that newer sources have superseded)
3. Data gaps (important questions the wiki can't answer — suggest specific sources to find)
4. Concepts mentioned but lacking depth

Wiki pages (sample of ${sample.length} pages):
${pagesContext}

Return a markdown lint report with these sections:
## Contradictions
## Stale Content
## Data Gaps & Suggested Sources
## Concepts Needing More Depth

Be specific — name the exact pages and claims involved.
`,
        },
      ],
    },
    { workflow: "lint" },
  );

  const firstBlock = response.content[0];
  const semanticReport = firstBlock?.type === "text" ? firstBlock.text : "";

  const reportLines: string[] = [
    `# Wiki Lint Report — ${today}`,
    "",
    `Scanned ${pages.length} pages.`,
    "",
    "## Structural Issues",
    "",
  ];

  if (orphans.length > 0) {
    reportLines.push("### Orphan Pages (no inbound links)");
    for (const p of orphans) {
      reportLines.push(`- \`${path.relative(REPO_ROOT, p)}\``);
    }
    reportLines.push("");
  }

  if (broken.length > 0) {
    reportLines.push("### Broken Wikilinks");
    for (const b of broken) {
      reportLines.push(`- \`${b.sourcePage}\` links to \`[[${b.targetLink}]]\` — not found`);
    }
    reportLines.push("");
  }

  if (missingEntities.length > 0) {
    reportLines.push("### Missing Entity Pages (mentioned 3+ times but no page)");
    for (const name of missingEntities) {
      reportLines.push(`- \`[[${name}]]\``);
    }
    reportLines.push("");
  }

  if (orphans.length === 0 && broken.length === 0 && missingEntities.length === 0) {
    reportLines.push("No structural issues found.");
    reportLines.push("");
  }

  reportLines.push("---");
  reportLines.push("");
  reportLines.push(semanticReport);

  const report = reportLines.join("\n");
  console.log("\n" + report);

  if (save && report) {
    const reportPath = path.join(WIKI_DIR, "lint-report.md");
    await writeFile(reportPath, report);
  }

  const logMsg = save
    ? `## [${today}] lint | Wiki health check\n\nRan lint. See lint-report.md for details.`
    : `## [${today}] lint | Wiki health check\n\nRan lint on ${pages.length} pages.`;
  await appendLog(logMsg);

  usageTracker.printSummary();

  return report;
}
