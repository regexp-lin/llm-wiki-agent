import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

import {
  REPO_ROOT,
  GRAPH_DIR,
  GRAPH_JSON,
  GRAPH_HTML,
  CACHE_FILE,
  TYPE_COLORS,
  TYPE_SHAPES,
  EDGE_COLORS,
  COMMUNITY_COLORS,
  MODEL_HAIKU,
} from "../shared/constants.js";
import { readFile, appendLog, readFilesParallel } from "../shared/file-utils.js";
import {
  allWikiPages,
  extractWikilinks,
  extractFrontmatterType,
  extractTitle,
  pageId,
} from "../shared/wiki-utils.js";
import { callLlm, parseJsonArrayFromResponse } from "../shared/llm-utils.js";
import { sha256Full } from "../shared/crypto-utils.js";
import { InferredRelationSchema } from "../shared/validators.js";
import { ProgressTracker } from "../shared/progress.js";
import { Semaphore } from "../shared/semaphore.js";
import { usageTracker } from "../shared/usage-tracker.js";
import { UndirectedGraph } from "graphology";
import louvainImport from "graphology-communities-louvain";

const louvain = louvainImport as unknown as (
  graph: InstanceType<typeof UndirectedGraph>,
  options?: { randomWalk?: boolean },
) => Record<string, number>;
import type { GraphNode, GraphEdge, GraphCache } from "../shared/types.js";

async function loadCache(): Promise<GraphCache> {
  try {
    const raw = await readFile(CACHE_FILE);
    if (!raw) return {};
    return JSON.parse(raw) as GraphCache;
  } catch {
    return {};
  }
}

async function saveCache(cache: GraphCache): Promise<void> {
  await fs.mkdir(GRAPH_DIR, { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
}

function buildNodes(pages: string[], contents: Map<string, string>): GraphNode[] {
  const nodes: GraphNode[] = [];
  for (const p of pages) {
    const content = contents.get(p) ?? "";
    const nodeType = extractFrontmatterType(content);
    const label = extractTitle(content, p);
    nodes.push({
      id: pageId(p),
      label,
      type: nodeType,
      color: TYPE_COLORS[nodeType] ?? TYPE_COLORS["unknown"]!,
      shape: TYPE_SHAPES[nodeType] ?? TYPE_SHAPES["unknown"]!,
      path: path.relative(REPO_ROOT, p),
    });
  }
  return nodes;
}

function buildExtractedEdges(pages: string[], contents: Map<string, string>): GraphEdge[] {
  const stemMap = new Map<string, string>();
  for (const p of pages) {
    const stem = path.basename(p, ".md").toLowerCase();
    stemMap.set(stem, pageId(p));
  }

  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  for (const p of pages) {
    const content = contents.get(p) ?? "";
    const src = pageId(p);
    const links = extractWikilinks(content);

    for (const link of links) {
      const target = stemMap.get(link.toLowerCase());
      if (target && target !== src) {
        const key = `${src}->${target}`;
        if (!seen.has(key)) {
          seen.add(key);
          edges.push({
            from: src,
            to: target,
            type: "EXTRACTED",
            color: EDGE_COLORS["EXTRACTED"]!,
            confidence: 1.0,
          });
        }
      }
    }
  }

  return edges;
}

async function buildInferredEdges(
  pages: string[],
  contents: Map<string, string>,
  existingEdges: GraphEdge[],
  cache: GraphCache,
  concurrency = 5,
): Promise<GraphEdge[]> {
  const newEdges: GraphEdge[] = [];

  const changedPages: string[] = [];
  for (const p of pages) {
    const content = contents.get(p) ?? "";
    const h = sha256Full(content);
    if (cache[p] !== h) {
      changedPages.push(p);
      cache[p] = h;
    }
  }

  if (changedPages.length === 0) {
    console.log("  no changed pages — skipping semantic inference");
    return [];
  }

  console.log(`  inferring relationships for ${changedPages.length} changed pages...`);

  const nodeList = pages
    .map((p) => `- ${pageId(p)} (${extractFrontmatterType(contents.get(p) ?? "")})`)
    .join("\n");
  const existingEdgeSummary = existingEdges
    .slice(0, 30)
    .map((e) => `- ${e.from} → ${e.to} (EXTRACTED)`)
    .join("\n");

  const validNodeIds = new Set(pages.map((p) => pageId(p)));
  const semaphore = new Semaphore(concurrency);
  const progress = new ProgressTracker(changedPages.length, "inference");

  const results = await Promise.allSettled(
    changedPages.map(async (p) => {
      await semaphore.acquire();
      try {
        const content = (contents.get(p) ?? "").slice(0, 2000);
        const src = pageId(p);

        const response = await callLlm(
          {
            model: MODEL_HAIKU,
            max_tokens: 1024,
            messages: [
              {
                role: "user",
                content: `Analyze this wiki page and identify implicit semantic relationships to other pages in the wiki.

Source page: ${src}
Content:
${content}

All available pages:
${nodeList}

Already-extracted edges from this page:
${existingEdgeSummary}

Return ONLY a JSON array of NEW relationships not already captured by explicit wikilinks:
[
  {"to": "page-id", "relationship": "one-line description", "confidence": 0.0-1.0, "type": "INFERRED or AMBIGUOUS"}
]

Rules:
- Only include pages from the available list above
- Confidence >= 0.7 → INFERRED, < 0.7 → AMBIGUOUS
- Do not repeat edges already in the extracted list
- Return empty array [] if no new relationships found
`,
              },
            ],
          },
          { workflow: "graph" },
        );

        const firstBlock = response.content[0];
        if (firstBlock?.type !== "text") return [];

        const pageEdges: GraphEdge[] = [];
        try {
          const inferred = parseJsonArrayFromResponse(firstBlock.text);
          for (const rel of inferred) {
            const parsed = InferredRelationSchema.safeParse(rel);
            if (parsed.success && validNodeIds.has(parsed.data.to)) {
              const { to, relationship, confidence, type: edgeType } = parsed.data;
              pageEdges.push({
                from: src,
                to,
                type: edgeType,
                label: relationship ?? "",
                color: EDGE_COLORS[edgeType] ?? EDGE_COLORS["INFERRED"]!,
                confidence,
              });
            }
          }
        } catch {
          // skip unparseable response
        }

        progress.tick(src);
        return pageEdges;
      } finally {
        semaphore.release();
      }
    }),
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      newEdges.push(...result.value);
    } else {
      console.warn(`  inference failed: ${result.reason}`);
    }
  }

  return newEdges;
}

function detectCommunities(nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> {
  try {
    const graph = new UndirectedGraph();

    for (const node of nodes) {
      graph.addNode(node.id);
    }
    for (const edge of edges) {
      if (!graph.hasEdge(edge.from, edge.to)) {
        try {
          graph.addEdge(edge.from, edge.to);
        } catch {
          // skip if nodes missing
        }
      }
    }

    if (graph.size === 0) return new Map();

    const communities = louvain(graph, { randomWalk: false });
    const result = new Map<string, number>();
    for (const [nodeId, communityId] of Object.entries(communities)) {
      result.set(nodeId, communityId as number);
    }
    return result;
  } catch {
    console.warn("Warning: graphology/louvain not available. Community detection disabled.");
    return new Map();
  }
}

function getVisNetworkSource(): string {
  try {
    const require = createRequire(import.meta.url);
    const visPath = require.resolve("vis-network/standalone/umd/vis-network.min.js");
    return readFileSync(visPath, "utf-8");
  } catch {
    return "";
  }
}

function renderHtml(nodes: GraphNode[], edges: GraphEdge[]): string {
  const nodesJson = JSON.stringify(nodes, null, 2);
  const edgesJson = JSON.stringify(edges, null, 2);

  const visSource = getVisNetworkSource();
  const scriptTag = visSource
    ? `<script>${visSource}</script>`
    : `<script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>`;

  const legendItems = Object.entries(TYPE_COLORS)
    .filter(([t]) => t !== "unknown")
    .map(
      ([t, color]) =>
        `<span style="background:${color};padding:3px 8px;margin:2px;border-radius:3px;font-size:12px">${t}</span>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>LLM Wiki — Knowledge Graph</title>
${scriptTag}
<style>
  body { margin: 0; background: #1a1a2e; font-family: sans-serif; color: #eee; }
  #graph { width: 100vw; height: 100vh; }
  #controls {
    position: fixed; top: 10px; left: 10px; background: rgba(0,0,0,0.7);
    padding: 12px; border-radius: 8px; z-index: 10; max-width: 260px;
  }
  #controls h3 { margin: 0 0 8px; font-size: 14px; }
  #search { width: 100%; padding: 4px; margin-bottom: 8px; background: #333; color: #eee; border: 1px solid #555; border-radius: 4px; }
  #info {
    position: fixed; bottom: 10px; left: 10px; background: rgba(0,0,0,0.8);
    padding: 12px; border-radius: 8px; z-index: 10; max-width: 320px;
    display: none;
  }
  #stats { position: fixed; top: 10px; right: 10px; background: rgba(0,0,0,0.7); padding: 10px; border-radius: 8px; font-size: 12px; }
</style>
</head>
<body>
<div id="controls">
  <h3>LLM Wiki Graph</h3>
  <input id="search" type="text" placeholder="Search nodes..." oninput="searchNodes(this.value)">
  <div>${legendItems}</div>
  <div style="margin-top:8px;font-size:11px;color:#aaa">
    <span style="background:#555;padding:2px 6px;border-radius:3px;margin-right:4px">──</span> Explicit link<br>
    <span style="background:#FF5722;padding:2px 6px;border-radius:3px;margin-right:4px">──</span> Inferred
  </div>
</div>
<div id="graph"></div>
<div id="info">
  <b id="info-title"></b><br>
  <span id="info-type" style="font-size:12px;color:#aaa"></span><br>
  <span id="info-path" style="font-size:11px;color:#666"></span>
</div>
<div id="stats"></div>
<script>
const nodes = new vis.DataSet(${nodesJson});
const edges = new vis.DataSet(${edgesJson});

const container = document.getElementById("graph");
const network = new vis.Network(container, { nodes, edges }, {
  nodes: {
    size: 12,
    font: { color: "#eee", size: 13 },
    borderWidth: 2,
  },
  edges: {
    width: 1.2,
    smooth: { type: "continuous" },
    arrows: { to: { enabled: true, scaleFactor: 0.5 } },
  },
  physics: {
    stabilization: { iterations: 150 },
    barnesHut: { gravitationalConstant: -8000, springLength: 120 },
  },
  interaction: { hover: true, tooltipDelay: 200 },
});

network.on("click", params => {
  if (params.nodes.length > 0) {
    const node = nodes.get(params.nodes[0]);
    document.getElementById("info").style.display = "block";
    document.getElementById("info-title").textContent = node.label;
    document.getElementById("info-type").textContent = node.type;
    document.getElementById("info-path").textContent = node.path;
  } else {
    document.getElementById("info").style.display = "none";
  }
});

document.getElementById("stats").textContent =
  \`\${nodes.length} nodes · \${edges.length} edges\`;

function searchNodes(q) {
  const lower = q.toLowerCase();
  nodes.forEach(n => {
    nodes.update({ id: n.id, opacity: (!q || n.label.toLowerCase().includes(lower)) ? 1 : 0.15 });
  });
}
</script>
</body>
</html>`;
}

export async function buildGraph(infer: boolean = true, openBrowser?: boolean): Promise<void> {
  const pages = await allWikiPages();
  const today = new Date().toISOString().slice(0, 10);

  if (pages.length === 0) {
    console.log("Wiki is empty. Ingest some sources first.");
    return;
  }

  console.log(`Building graph from ${pages.length} wiki pages...`);
  await fs.mkdir(GRAPH_DIR, { recursive: true });

  const contents = await readFilesParallel(pages);

  const cache = await loadCache();

  console.log("  Pass 1: extracting wikilinks...");
  const nodes = buildNodes(pages, contents);
  const edges = buildExtractedEdges(pages, contents);
  console.log(`  → ${edges.length} extracted edges`);

  if (infer) {
    console.log("  Pass 2: inferring semantic relationships...");
    const inferred = await buildInferredEdges(pages, contents, edges, cache);
    edges.push(...inferred);
    console.log(`  → ${inferred.length} inferred edges`);
    await saveCache(cache);
  }

  console.log("  Running Louvain community detection...");
  const communities = detectCommunities(nodes, edges);
  for (const node of nodes) {
    const commId = communities.get(node.id) ?? -1;
    node.group = commId;
    if (commId >= 0) {
      node.borderColor = COMMUNITY_COLORS[commId % COMMUNITY_COLORS.length]!;
      node.borderWidth = 3;
    }
  }

  const graphData = { nodes, edges, built: today };
  await fs.writeFile(GRAPH_JSON, JSON.stringify(graphData, null, 2), "utf-8");
  console.log(`  saved: graph/graph.json  (${nodes.length} nodes, ${edges.length} edges)`);

  const html = renderHtml(nodes, edges);
  await fs.writeFile(GRAPH_HTML, html, "utf-8");
  console.log("  saved: graph/graph.html");

  const extractedCount = edges.filter((e) => e.type === "EXTRACTED").length;
  const inferredCount = edges.filter((e) => e.type === "INFERRED").length;
  await appendLog(
    `## [${today}] graph | Knowledge graph rebuilt\n\n${nodes.length} nodes, ${edges.length} edges (${extractedCount} extracted, ${inferredCount} inferred).`,
  );

  usageTracker.printSummary();

  if (openBrowser) {
    const openModule = await import("open");
    await openModule.default(`file://${path.resolve(GRAPH_HTML)}`);
  }
}
