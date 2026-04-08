import fs from "node:fs/promises";
import path from "node:path";
import { WIKI_DIR, EXCLUDED_PAGES } from "./constants.js";
import type { PageType } from "./types.js";

export async function allWikiPages(): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.name.endsWith(".md") && !EXCLUDED_PAGES.has(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  await walk(WIKI_DIR);
  return results;
}

export function extractWikilinks(content: string): string[] {
  const matches = content.matchAll(/\[\[([^\]]+)\]\]/g);
  return [...new Set([...matches].map((m) => m[1]!))];
}

export function extractFrontmatterType(content: string): PageType {
  const match = content.match(/^type:\s*(\S+)/m);
  if (!match?.[1]) return "unknown";
  const raw = match[1].replace(/["']/g, "");
  const valid: PageType[] = ["source", "entity", "concept", "synthesis"];
  return valid.includes(raw as PageType) ? (raw as PageType) : "unknown";
}

export function extractTitle(content: string, filePath: string): string {
  const match = content.match(/^title:\s*"?([^"\n]+)"?/m);
  return match?.[1]?.trim() ?? path.basename(filePath, ".md");
}

export function pageId(filePath: string): string {
  return path.relative(WIKI_DIR, filePath).replace(/\.md$/, "").replace(/\\/g, "/");
}

export async function pageNameToPath(name: string): Promise<string[]> {
  const pages = await allWikiPages();
  const nameLower = name.toLowerCase();
  return pages.filter((p) => {
    const stem = path.basename(p, ".md").toLowerCase();
    return stem === nameLower;
  });
}

export async function buildPageNameMap(
  pages?: string[],
): Promise<Map<string, string[]>> {
  const resolvedPages = pages ?? (await allWikiPages());
  const nameMap = new Map<string, string[]>();
  for (const p of resolvedPages) {
    const stem = path.basename(p, ".md").toLowerCase();
    const existing = nameMap.get(stem) ?? [];
    existing.push(p);
    nameMap.set(stem, existing);
  }
  return nameMap;
}
